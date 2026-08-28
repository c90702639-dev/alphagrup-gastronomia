import { useEffect, useMemo, useState } from "react";
import type { Lead } from "../lib/seed";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

const ESTADOS = ["nuevo", "contactado", "cotizada", "ganado", "perdido"] as const;
const badge: Record<string, string> = {
  nuevo: "bg-cobre text-white",
  contactado: "bg-tinta text-papel",
  cotizada: "bg-acero-2 text-tinta",
  ganado: "bg-exito text-white",
  perdido: "bg-alerta text-white",
};

export default function LeadsInbox() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtro, setFiltro] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Lead | null>(null);
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/portal/leads");
    if (res.ok) setLeads(await res.json());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        if (filtro !== "todos" && l.estado !== filtro) return false;
        if (q) {
          const hay = `${l.nombre} ${l.empresa} ${l.pais} ${l.items.map((i) => i.name).join(" ")}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [leads, filtro, q]
  );

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch("/api/portal/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      const updated: Lead = await res.json();
      setLeads((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));
      if (sel?.id === id) setSel(updated);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
      {/* Lista */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {["todos", ...ESTADOS].map((est) => (
            <button
              key={est}
              onClick={() => setFiltro(est)}
              className={`px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filtro === est ? "bg-tinta text-papel" : "border border-linea bg-white hover:bg-papel-2"
              }`}
            >
              {est === "todos" ? `Todos (${leads.length})` : `${est} (${leads.filter((l) => l.estado === est).length})`}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente o equipo…"
            className="ml-auto w-full max-w-xs border border-linea px-3 py-1.5 text-sm focus:border-cobre focus:outline-none"
          />
        </div>

        <div className="mt-4 divide-y divide-linea border border-linea bg-white">
          {loading && <p className="px-5 py-10 text-center text-sm text-tinta-3">Cargando…</p>}
          {!loading && filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-tinta-3">Sin leads que coincidan.</p>
          )}
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSel(l);
                setNota("");
              }}
              className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-papel-2/60 ${
                sel?.id === l.id ? "bg-papel-2" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.empresa || l.nombre}</p>
                <p className="mt-0.5 truncate text-xs text-tinta-3">
                  {l.pais} · {l.items.length} equipo(s) ·{" "}
                  {new Date(l.fecha).toLocaleDateString("es-MX")}
                  {l.demo && <em className="ml-2 not-italic text-acero-2">demo</em>}
                </p>
              </div>
              <span className="hidden font-display font-semibold sm:block">{money(l.total)}</span>
              <span className={`px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wide ${badge[l.estado]}`}>
                {l.estado}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Detalle */}
      <aside className="h-fit lg:sticky lg:top-24">
        {!sel ? (
          <div className="border border-dashed border-linea p-10 text-center text-sm text-tinta-3">
            Selecciona un lead para ver el detalle.
          </div>
        ) : (
          <div className="border border-linea bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{sel.nombre}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{sel.empresa}</h2>
                <p className="mt-1 text-sm text-tinta-3">{sel.pais}</p>
              </div>
              <span className={`px-2 py-1 text-[0.68rem] font-bold uppercase ${badge[sel.estado]}`}>
                {sel.estado}
              </span>
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <a href={`mailto:${sel.email}`} className="block text-cobre hover:underline">✉ {sel.email}</a>
              <a href={`https://wa.me/${sel.telefono.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="block text-cobre hover:underline">
                ✆ {sel.telefono}
              </a>
            </div>

            {sel.mensaje && (
              <p className="mt-3 border-l-2 border-linea bg-papel-2/50 px-3 py-2 text-sm italic">“{sel.mensaje}”</p>
            )}

            <table className="spec-sheet mt-5 !border-0 !text-sm">
              <tbody>
                {sel.items.map((it) => (
                  <tr key={it.slug}>
                    <th>{it.brand}</th>
                    <td>
                      {it.qty}× {it.name}{" "}
                      <span className="float-right text-tinta-3">{money(it.price * it.qty)}</span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <th className="!text-tinta font-semibold">Total</th>
                  <td className="font-display text-lg font-semibold text-cobre">{money(sel.total)}</td>
                </tr>
              </tbody>
            </table>

            {/* Estado */}
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-tinta-3">Estado del lead</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ESTADOS.map((est) => (
                <button
                  key={est}
                  onClick={() => patch(sel.id, { estado: est })}
                  className={`px-2.5 py-1 text-xs font-semibold capitalize ${
                    sel.estado === est ? badge[est] : "border border-linea hover:bg-papel-2"
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>

            {/* Notas */}
            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-tinta-3">
              Notas internas ({sel.notas.length})
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (nota.trim()) {
                  patch(sel.id, { nota });
                  setNota("");
                }
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Añadir nota…"
                className="min-w-0 flex-1 border border-linea px-3 py-2 text-sm focus:border-cobre focus:outline-none"
              />
              <button type="submit" className="btn btn-outline !px-3 !py-1.5 text-xs">Guardar</button>
            </form>
            <ul className="mt-3 space-y-2">
              {sel.notas.map((n, i) => (
                <li key={i} className="bg-papel-2/60 px-3 py-2 text-xs leading-relaxed">
                  {n.texto}
                  <span className="mt-0.5 block text-[0.65rem] text-tinta-3">
                    {new Date(n.ts).toLocaleString("es-MX")}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href={`/portal/cotizador?lead=${sel.id}`}
              className="btn btn-primary mt-5 w-full !py-2.5 text-sm"
            >
              Crear cotización desde este lead
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}
