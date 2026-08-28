import { useEffect, useState } from "react";
import {
  getQuote,
  setQty,
  removeItem,
  clear,
  onQuoteChange,
  type QuoteItem,
} from "./quoteStore";

const money = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(n);

/** Volume discount on the whole quote by total units */
function tierFor(units: number): number {
  if (units >= 10) return 8;
  if (units >= 5) return 5;
  return 0;
}

const inputCls =
  "w-full border border-linea bg-white px-3.5 py-2.5 text-sm focus:border-cobre focus:outline-none";

export default function QuoteView() {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(getQuote());
    return onQuoteChange(() => setItems(getQuote()));
  }, []);

  const units = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((n, i) => n + i.qty * i.final, 0);
  const pct = tierFor(units);
  const descuento = Math.round((subtotal * pct) / 100);
  const total = subtotal - descuento;

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!items.length) return;
    setSending(true);
    setError("");
    const form = new FormData(e.target as HTMLFormElement);
    try {
      const res = await fetch("/api/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.get("nombre"),
          empresa: form.get("empresa"),
          email: form.get("email"),
          telefono: form.get("telefono"),
          pais: form.get("pais"),
          mensaje: form.get("mensaje"),
          items,
          subtotal,
          descuentoPct: pct,
          total,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSent(true);
      clear();
    } catch (err) {
      setError("No se pudo enviar la solicitud. Intenta de nuevo o contáctanos por WhatsApp.");
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  if (sent)
    return (
      <div className="container-x py-24 text-center">
        <p className="font-display text-4xl font-semibold text-exito">✓</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Solicitud enviada</h1>
        <p className="mx-auto mt-3 max-w-md text-tinta-2">
          Nuestro equipo te contactará en menos de 24 horas hábiles con tu
          cotización formal.
        </p>
        <a href="/productos" className="btn btn-primary mt-8">
          Seguir explorando
        </a>
      </div>
    );

  if (!items.length)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">Tu cotización está vacía</h1>
        <p className="mt-3 text-tinta-2">
          Agrega equipos desde el catálogo y solicita precios con descuentos incluidos.
        </p>
        <a href="/productos" className="btn btn-primary mt-7">
          Ver catálogo
        </a>
      </div>
    );

  return (
    <div className="container-x grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr]">
      {/* Items */}
      <div>
        <h1 className="font-display text-3xl font-semibold">
          Cotización <span class="text-tinta-3">({items.length})</span>
        </h1>

        <ul className="mt-7 divide-y divide-linea border-y border-linea">
          {items.map((i) => (
            <li key={i.slug} className="flex gap-4 py-4">
              <img
                src={i.localImage || "/favicon.svg"}
                alt=""
                width="80"
                height="80"
                loading="lazy"
                className="size-20 shrink-0 border border-linea bg-white object-contain p-1.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">
                  {i.brand}
                </p>
                <a href={`/productos/${i.slug}/`} className="line-clamp-2 font-medium hover:text-cobre">
                  {i.name}
                </a>
                <p className="mt-1 text-sm text-tinta-3">{money(i.final)} c/u</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={i.qty}
                  onChange={(e) => setQty(i.slug, Number(e.target.value))}
                  aria-label={`Cantidad de ${i.name}`}
                  className="w-16 border border-linea px-2 py-1 text-sm focus:border-cobre focus:outline-none"
                />
                <button
                  onClick={() => removeItem(i.slug)}
                  className="text-xs font-medium text-alerta hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button onClick={() => clear()} className="mt-4 text-sm font-medium text-tinta-3 hover:text-alerta">
          Vaciar cotización
        </button>
      </div>

      {/* Resumen + formulario */}
      <aside className="h-fit border border-linea bg-white p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-xl font-semibold">Resumen</h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between"><dt class="text-tinta-3">Piezas</dt><dd>{units}</dd></div>
          <div class="flex justify-between"><dt class="text-tinta-3">Subtotal</dt><dd>{money(subtotal)}</dd></div>
          <div class="flex justify-between text-exito">
            <dt>Descuento por volumen ({pct}%)</dt>
            <dd>−{money(descuento)}</dd>
          </div>
          <div class="flex justify-between border-t border-linea pt-3 font-display text-xl font-semibold">
            <dt>Total estimado</dt>
            <dd class="text-cobre">{money(total)}</dd>
          </div>
        </dl>

        <form onSubmit={submit} class="mt-6 space-y-3">
          <input required name="nombre" placeholder="Nombre completo *" className={inputCls} />
          <input name="empresa" placeholder="Empresa / negocio" className={inputCls} />
          <input required type="email" name="email" placeholder="Correo electrónico *" className={inputCls} />
          <input name="telefono" placeholder="Teléfono / WhatsApp" className={inputCls} />
          <select name="pais" className={inputCls} defaultValue="México">
            {["México","Guatemala","Costa Rica","Colombia","Perú","El Salvador","República Dominicana"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <textarea name="mensaje" rows="3" placeholder="Comentarios (fechas, ubicación de entrega…)" className={inputCls} />

          {error && <p class="text-sm text-alerta">{error}</p>}

          <button type="submit" disabled={sending} className="btn btn-primary w-full py-3 disabled:opacity-60">
            {sending ? "Enviando…" : "Enviar solicitud de cotización"}
          </button>
          <p class="text-center text-xs text-tinta-3">
            Respuesta en menos de 24 h hábiles · Sin compromiso
          </p>
        </form>
      </aside>
    </div>
  );
}
