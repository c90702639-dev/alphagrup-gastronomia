import { useEffect, useMemo, useState } from "react";
import type { QuoteRecord } from "../pages/api/portal/quotes";

interface P {
  slug: string;
  name: string;
  brand: string;
  price: number;
}
interface Line extends P {
  qty: number;
  descuento: number;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

export default function QuoteBuilder({
  products,
  prefill,
}: {
  products: P[];
  prefill?: { leadId?: string } | null;
}) {
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [cliente, setCliente] = useState("");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [descGlobal, setDescGlobal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<QuoteRecord | null>(null);
  const [error, setError] = useState("");

  // Prefill from a lead
  useEffect(() => {
    if (!prefill?.leadId) return;
    (async () => {
      const res = await fetch("/api/portal/leads");
      if (!res.ok) return;
      const leads = await res.json();
      const lead = leads.find((l: any) => l.id === prefill.leadId);
      if (!lead) return;
      setCliente(lead.empresa || lead.nombre);
      setContacto(lead.nombre);
      setEmail(lead.email || "");
      setLines(
        lead.items.map((it: any) => ({
          slug: it.slug,
          name: it.name,
          brand: it.brand,
          price: it.price,
          qty: it.qty,
          descuento: 0,
        }))
      );
    })();
  }, [prefill?.leadId]);

  /* volume tier suggestion */
  const units = lines.reduce((n, l) => n + l.qty, 0);
  const suggestedTier = units >= 10 ? 8 : units >= 5 ? 5 : 0;

  const subtotal = useMemo(
    () => lines.reduce((n, l) => n + Math.round(l.qty * l.price * (1 - l.descuento / 100)), 0),
    [lines]
  );
  const total = Math.round(subtotal * (1 - descGlobal / 100));

  const results = useMemo(() => {
    if (!q.trim() || q.length < 2) return [];
    const needle = q.toLowerCase();
    return products.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(needle)).slice(0, 6);
  }, [q, products]);

  function addLine(p: P) {
    setLines((ls) =>
      ls.some((l) => l.slug === p.slug)
        ? ls.map((l) => (l.slug === p.slug ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { ...p, qty: 1, descuento: 0 }]
    );
    setQ("");
  }

  async function guardarYGenerar() {
    if (!lines.length || !cliente.trim()) {
      setError("Agrega al menos un equipo y el nombre del cliente.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/portal/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente,
          contacto,
          email,
          items: lines,
          descuentoGlobal,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const quote: QuoteRecord = await res.json();
      setSaved(quote);
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (saved)
    return (
      <div className="mx-auto max-w-2xl border border-linea bg-white p-10 text-center">
        <p className="font-display text-3xl font-semibold text-exito">✓</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">
          Cotización {saved.folio} guardada
        </h2>
        <p className="mt-2 text-sm text-tinta-3">
          {saved.cliente} · {money(saved.total)} · estado: {saved.estado}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href={`/portal/cotizador/${saved.id}/imprimir`} target="_blank" className="btn btn-primary">
            Vista imprimible / PDF ↗
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Hola ${saved.contacto}, te comparto la cotización ${saved.folio} de Grupo Alpha por ${money(saved.total)} MXN. Quedo atento a tus comentarios.`
            )}`}
            target="_blank"
            rel="noopener"
            className="btn btn-outline"
          >
            Compartir por WhatsApp
          </a>
          <button onClick={() => location.assign("/portal/cotizador")} className="btn btn-outline">
            Nueva cotización
          </button>
        </div>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Editor */}
      <div>
        <div className="grid gap-4 border border-linea bg-white p-6 sm:grid-cols-3">
          <label className="block text-sm font-medium">Empresa / cliente *
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="mt-1 w-full border border-linea px-3 py-2 text-sm focus:border-cobre focus:outline-none" placeholder="Restaurante…" />
          </label>
          <label className="block text-sm font-medium">Contacto
            <input value={contacto} onChange={(e) => setContacto(e.target.value)} className="mt-1 w-full border border-linea px-3 py-2 text-sm focus:border-cobre focus:outline-none" />
          </label>
          <label className="block text-sm font-medium">Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-linea px-3 py-2 text-sm focus:border-cobre focus:outline-none" />
          </label>
        </div>

        {/* Product picker */}
        <div className="relative mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar equipo para agregar (nombre o marca)…"
            className="w-full border border-linea bg-white px-4 py-3 text-sm focus:border-cobre focus:outline-none"
          />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full border border-linea bg-white shadow-lg">
              {results.map((p) => (
                <li key={p.slug}>
                  <button onClick={() => addLine(p)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-papel-2">
                    <span><strong>{p.brand}</strong> · {p.name}</span>
                    <span className="text-tinta-3">{money(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lines */}
        <table className="spec-sheet mt-4 !border-0 bg-white !text-sm">
          <thead>
            <tr class="!text-[0.7rem] uppercase tracking-wide">
              <th>Equipo</th><th>Cant.</th><th>Precio</th><th>Desc.%</th><th>Importe</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-tinta-3">Busca y agrega equipos arriba.</td></tr>
            )}
            {lines.map((l) => (
              <tr key={l.slug}>
                <td>
                  <span className="font-medium">{l.name}</span>
                  <span className="block text-xs text-tinta-3">{l.brand}</span>
                </td>
                <td className="!w-20">
                  <input type="number" min={1} max={999} value={l.qty}
                    onChange={(e) => setLines((ls) => ls.map((x) => x.slug === l.slug ? { ...x, qty: Number(e.target.value) } : x))}
                    className="w-16 border border-linea px-2 py-1" aria-label={`Cantidad ${l.name}`} />
                </td>
                <td>{money(l.price)}</td>
                <td className="!w-20">
                  <input type="number" min={0} max={50} value={l.descuento}
                    onChange={(e) => setLines((ls) => ls.map((x) => x.slug === l.slug ? { ...x, descuento: Number(e.target.value) } : x))}
                    className="w-16 border border-linea px-2 py-1" aria-label={`Descuento ${l.name}`} />
                </td>
                <td className="font-medium">{money(Math.round(l.qty * l.price * (1 - l.descuento / 100)))}</td>
                <td>
                  <button onClick={() => setLines((ls) => ls.filter((x) => x.slug !== l.slug))} className="text-alerta hover:underline" aria-label={`Quitar ${l.name}`}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <aside className="h-fit border border-linea bg-white p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-xl font-semibold">Resumen</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-tinta-3">Piezas</dt><dd>{units}</dd></div>
          <div className="flex justify-between"><dt className="text-tinta-3">Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <li className="flex items-center justify-between">
            <dt className="text-tinta-3">Descuento global %</dt>
            <dd className="flex items-center gap-2">
              <input type="number" min={0} max={30} value={descGlobal} onChange={(e) => setDescGlobal(Number(e.target.value))} className="w-16 border border-linea px-2 py-1 text-right" aria-label="Descuento global" />
              {suggestedTier > descGlobal && (
                <button onClick={() => setDescGlobal(suggestedTier)} title="Aplicar volumen sugerido" className="bg-cobre px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                  vol. {suggestedTier}%
                </button>
              )}
            </dd>
          </li>
          <div className="flex justify-between border-t border-linea pt-3 font-display text-xl font-semibold">
            <dt>Total</dt><dd className="text-cobre">{money(total)}</dd>
          </div>
        </dl>

        {error && <p className="mt-4 text-sm text-alerta">{error}</p>}
        <button onClick={guardarYGenerar} disabled={saving || !lines.length} className="btn btn-primary mt-5 w-full py-3 disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar y generar vista"}
        </button>
        <p className="mt-3 text-center text-xs text-tinta-3">Se guarda en el portal · luego puedes marcarla enviada/aceptada</p>
      </aside>
    </div>
  );
}
