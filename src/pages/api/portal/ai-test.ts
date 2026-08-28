import type { APIRoute } from "astro";
import { routeChat } from "../../../lib/ai/router";
import { apiKeys } from "../../../lib/ai/config";

export const prerender = false;

/** Pings the router with a tiny prompt — reports which key/model answered. */
export const POST: APIRoute = async () => {
  const keys = apiKeys().length;
  if (!keys) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Sin keys configuradas. Agrega OPENROUTER_KEYS en .env y reinicia.",
        keys,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const t0 = Date.now();
  try {
    const result = await routeChat({
      messages: [{ role: "user", content: "Responde solo con la palabra: listo" }],
      max_tokens: 10,
      temperature: 0,
    });

    if (!result.response) {
      return new Response(
        JSON.stringify({
          ok: false,
          keys,
          attempts: result.attempts,
          error: "Ningún modelo respondió (rate limits o keys inválidas).",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const j = await result.response.json();
    return new Response(
      JSON.stringify({
        ok: true,
        keys,
        keyIndex: result.usedKey,
        model: result.usedModel,
        ms: Date.now() - t0,
        reply: j.choices?.[0]?.message?.content?.slice(0, 40),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
