import type { APIRoute } from "astro";
import { retrieve, kbStats } from "../../lib/ai/retrieval";
import { routeChat } from "../../lib/ai/router";
import { apiKeys } from "../../lib/ai/config";

export const prerender = false;

const SYSTEM_PROMPT = `Eres el Asistente Técnico de Grupo Alpha, división Gastronomía.
Ayudas a vendedores a responder preguntas técnicas y comerciales sobre equipos de cocina profesional
(hornos combi, cocinas, freidoras, mantenedores, etc.) usando EXCLUSIVAMENTE la información del contexto.

REGLAS:
- Responde en español, breve y directo (máx. ~180 palabras salvo que pidan detalle).
- Cita SIEMPRE la fuente al final de cada dato técnico con el formato [fuente: <source>, pág. <page>].
  Si no hay página, usa solo [fuente: <source>].
- Si el contexto no contiene la respuesta, dilo claramente y sugiere contactar soporte técnico.
- NUNCA inventes especificaciones, precios ni disponibilidad.
- Para comparaciones, usa una lista corta por puntos.`;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      ok: true,
      keysConfigured: apiKeys().length,
      ...kbStats(),
    }),
    { headers: { "Content-Type": "application/json" } },
  );

export const POST: APIRoute = async ({ request }) => {
  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message)
    return new Response(JSON.stringify({ error: "Mensaje vacío" }), { status: 400 });

  if (!apiKeys().length)
    return new Response(
      JSON.stringify({
        error:
          "IA no configurada: agrega tus OpenRouter keys en OPENROUTER_KEYS (variables de entorno).",
      }),
      { status: 503 },
    );

  // 1) retrieve context
  const retrieval = await retrieve(message, 6);
  const context =
    retrieval.hits
      .map((h, i) => {
        const pg = h.chunk.page ? `, pág. ${h.chunk.page}` : "";
        return `[${i + 1}] (fuente: ${h.chunk.source}${pg})\n${h.chunk.text}`;
      })
      .join("\n\n") || "(sin resultados)";

  // 2) build messages
  const history = (body.history || []).slice(-8); // last 4 exchanges
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `CONTEXTO DE FICHAS TÉCNICAS Y CATÁLOGO:\n\n${context}`,
    },
    ...history.map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  // 3) route through key rotation × model cascade, stream back SSE
  const encoder = new TextEncoder();
  let upstream: AbortController | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const result = await routeChat(
          { messages, temperature: 0.2, max_tokens: 700, stream: true },
          // abort when client disconnects
          request.signal,
        );

        if (!result.response) {
          send({ type: "error", error: "Todos los modelos fallaron o están saturados. Intenta de nuevo en un minuto." });
          controller.close();
          return;
        }

        send({
          type: "meta",
          model: result.usedModel,
          mode: retrieval.mode,
          sources: retrieval.hits.map((h) => ({
            source: h.chunk.source,
            page: h.chunk.page ?? null,
            product: h.chunk.product ?? null,
          })),
          attempts: result.attempts.length,
        });

        const reader = result.response.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop()!;
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              const delta = j.choices?.[0]?.delta?.content;
              if (delta) send({ type: "token", token: delta });
            } catch {
              /* ignore keepalives/comments */
            }
          }
        }
        send({ type: "done" });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstream?.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
