import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; page: number | null }[];
  model?: string;
}

interface UsageStat {
  ts: number;
  model: string;
  ms: number;
  attempts: number;
  mode: string;
}
const USAGE_KEY = "ga_ai_usage_v1";

export function recordUsage(u: UsageStat) {
  try {
    const arr = JSON.parse(localStorage.getItem(USAGE_KEY) || "[]");
    arr.push(u);
    localStorage.setItem(USAGE_KEY, JSON.stringify(arr.slice(-200)));
  } catch {}
}

const SUGGESTIONS = [
  "¿Qué horno combi soporta más charolas GN?",
  "Compara las freidoras Cook Rite de 18 y 23 Lt",
  "¿Qué equipo recomiendas para un restaurante pequeño?",
  "Especificaciones del iCOMBI PRO",
];

export default function AiChat({ ready }: { ready: { keys: number; chunks: number } }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: q }]);
    const t0 = Date.now();

    const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    let assistant = "";
    let meta: Partial<Msg> = {};

    setMsgs((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(j.error || `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const evt = JSON.parse(line.slice(5));
            if (evt.type === "meta") {
              meta = { sources: evt.sources, model: evt.model };
              recordUsage({
                ts: Date.now(),
                model: evt.model,
                ms: Date.now() - t0,
                attempts: evt.attempts,
                mode: evt.mode,
              });
            }
            if (evt.type === "token") assistant += evt.token;
            if (evt.type === "error") assistant += `\n\n⚠️ ${evt.error}`;
          } catch {}
          setMsgs((m) => {
            const next = [...m];
            next[next.length - 1] = { role: "assistant", content: assistant, ...meta };
            return next;
          });
        }
      }
    } catch (e) {
      setMsgs((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          content: `${assistant}\n⚠️ ${(e as Error).message}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[480px] flex-col border border-linea bg-white">
      {/* header */}
      <div className="flex items-center justify-between border-b border-linea px-5 py-3">
        <div>
          <p className="font-display font-semibold">Asistente Técnico IA</p>
          <p className="text-xs text-tinta-3">
            {ready.chunks} documentos indexados ·{" "}
            {ready.keys > 0 ? (
              <>
                <span className="text-exito">●</span> {ready.keys} key(s) OpenRouter
              </>
            ) : (
              <span className="text-alerta">● sin keys configuradas</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setMsgs([])}
          className="text-xs font-medium text-tinta-3 hover:text-alerta"
        >
          Limpiar
        </button>
      </div>

      {/* messages */}
      <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {msgs.length === 0 && (
          <div className="mx-auto max-w-md pt-10 text-center">
            <span className="font-display text-3xl font-semibold text-cobre">α·IA</span>
            <p className="mt-3 text-sm leading-relaxed text-tinta-2">
              Pregunta especificaciones, capacidades, voltajes o compara equipos.
              Las respuestas citan la ficha técnica exacta.
            </p>
            <div className="mt-6 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="border border-linea px-4 py-2.5 text-left text-sm transition-colors hover:border-cobre hover:bg-papel-2/60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-sm bg-tinta px-4 py-2.5 text-sm text-papel">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[88%] border-l-2 border-cobre bg-papel-2/60 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                {busy && i === msgs.length - 1 && !m.content && (
                  <p className="animate-pulse text-sm text-tinta-3">Consultando fichas…</p>
                )}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-linea pt-2.5">
                    {m.sources.map((s, j) => (
                      <span
                        key={j}
                        title={s.product || s.source}
                        className="bg-white px-2 py-0.5 text-[0.68rem] font-medium text-tinta-3 outline outline-1 outline-linea"
                      >
                        📄 {s.source.split("/").pop()}
                        {s.page ? ` · p.${s.page}` : ""}
                      </span>
                    ))}
                    {m.model && (
                      <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-acero-2">
                        {m.model.split("/")[1]}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-linea p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta sobre cualquier equipo…"
          disabled={busy}
          className="flex-1 border border-linea px-4 py-2.5 text-sm focus:border-cobre focus:outline-none disabled:bg-papel-2"
        />
        <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary px-6 disabled:opacity-50">
          Enviar
        </button>
      </form>
    </div>
  );
}
