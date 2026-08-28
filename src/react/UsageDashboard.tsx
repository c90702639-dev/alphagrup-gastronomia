import { useEffect, useState } from "react";
import { recordUsage } from "./AiChat";

interface Stat {
  ts: number;
  model: string;
  ms: number;
  attempts: number;
  mode: string;
}

export default function UsageDashboard() {
  const [stats, setStats] = useState<Stat[]>([]);

  useEffect(() => {
    try {
      setStats(JSON.parse(localStorage.getItem("ga_ai_usage_v1") || "[]"));
    } catch {}
  }, []);

  const total = stats.length;
  const avgMs = total ? Math.round(stats.reduce((n, s) => n + s.ms, 0) / total) : 0;
  const failovers = stats.reduce((n, s) => n + Math.max(0, s.attempts - 1), 0);
  const byModel = stats.reduce<Record<string, number>>((acc, s) => {
    acc[s.model] = (acc[s.model] || 0) + 1;
    return acc;
  }, {});
  const estCost = (total * 0.0001).toFixed(4); // rough free-tier equivalent

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-linea bg-linea lg:grid-cols-4">
        {[
          ["Consultas", String(total)],
          ["Latencia prom.", `${(avgMs / 1000).toFixed(1)}s`],
          ["Failovers", String(failovers)],
          ["Costo estimado", `$${estCost}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-white p-6">
            <p className="eyebrow !text-tinta-3">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{val}</p>
          </div>
        ))}
      </div>

      {Object.keys(byModel).length > 0 && (
        <div className="border border-linea bg-white p-6">
          <h2 className="font-display text-xl font-semibold">Uso por modelo</h2>
          <ul className="mt-4 space-y-3">
            {Object.entries(byModel)
              .sort((a, b) => b[1] - a[1])
              .map(([m, count]) => {
                const pct = Math.round((count / total) * 100);
                return (
                  <li key={m}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{m.split("/")[1] || m}</span>
                      <span className="text-tinta-3">{count} · {pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-papel-2">
                      <div className="h-full bg-cobre" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-tinta-3">
            Estas métricas se acumulan en este navegador durante la fase de prueba.
            Al consolidar a una sola key de OpenRouter no cambia nada del código:
            solo edita la variable OPENROUTER_KEYS.
          </p>
        </div>
      )}

      {total > 0 && (
        <div className="border border-linea bg-white">
          <h2 className="border-b border-linea px-6 py-4 font-display text-xl font-semibold">
            Historial reciente
          </h2>
          <table class="spec-sheet !border-0">
            <thead>
              <tr>
                <th>Fecha</th><th>Modelo</th><th>Latencia</th><th>Intentos</th><th>Búsqueda</th>
              </tr>
            </thead>
            <tbody>
              {[...stats].reverse().slice(0, 15).map((s, i) => (
                <tr key={i}>
                  <td>{new Date(s.ts).toLocaleString("es-MX")}</td>
                  <td>{s.model?.split("/")[1] || "—"}</td>
                  <td>{(s.ms / 1000).toFixed(1)}s</td>
                  <td>{s.attempts}</td>
                  <td>{s.mode === "semantic" ? "Semántica" : "Léxica"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total === 0 && (
        <div className="border border-dashed border-linea py-16 text-center text-tinta-3">
          Aún hay consultas registradas. Úsalas en el Asistente IA y verás estadísticas aquí.
        </div>
      )}
    </div>
  );
}
