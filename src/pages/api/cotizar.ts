import type { APIRoute } from "astro";
import { save, newId, logActivity } from "../../lib/store";
import type { Lead } from "../../lib/seed";

export const prerender = false;

interface QuotePayload {
  nombre: string;
  empresa?: string;
  email: string;
  telefono?: string;
  pais?: string;
  mensaje?: string;
  items: { slug: string; name: string; qty: number; final: number; brand: string }[];
  subtotal: number;
  descuentoPct: number;
  total: number;
}

const SALES_EMAIL = () => import.meta.env.SALES_EMAIL || "ventas@grupoalpha.com";

function buildHtml(d: QuotePayload): string {
  const rows = d.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 10px;border:1px solid #ddd">${i.brand}</td><td style="padding:6px 10px;border:1px solid #ddd">${i.name}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${i.qty}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right">$${(i.final * i.qty).toLocaleString("es-MX")}</td></tr>`,
    )
    .join("");
  return `
  <h2>Nueva solicitud de cotización</h2>
  <p><strong>${d.nombre}</strong> ${d.empresa ? `(${d.empresa})` : ""} — ${d.pais || "—"}</p>
  <p>📧 ${d.email} · 📱 ${d.telefono || "—"}</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <thead><tr><th style="padding:6px 10px;border:1px solid #ddd">Marca</th><th style="padding:6px 10px;border:1px solid #ddd">Producto</th><th style="padding:6px 10px;border:1px solid #ddd">Cant.</th><th style="padding:6px 10px;border:1px solid #ddd">Importe</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Subtotal: $${d.subtotal.toLocaleString("es-MX")}<br/>
  Descuento volumen: ${d.descuentoPct}%<br/>
  <strong>Total estimado: $${d.total.toLocaleString("es-MX")} MXN</strong></p>
  ${d.mensaje ? `<p><em>“${d.mensaje}”</em></p>` : ""}
  `;
}

export const POST: APIRoute = async ({ request }) => {
  let data: QuotePayload;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!data.nombre || !data.email || !Array.isArray(data.items) || !data.items.length) {
    return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
    return new Response(JSON.stringify({ error: "Email inválido" }), { status: 400 });
  }

  /* ── persist lead (portal inbox) ─────────────────────────── */
  const lead: Lead = {
    id: newId("lead"),
    fecha: Date.now(),
    nombre: data.nombre,
    empresa: data.empresa || "",
    email: data.email,
    telefono: data.telefono || "",
    pais: data.pais || "",
    mensaje: data.mensaje,
    items: data.items.map((i) => ({
      slug: i.slug,
      name: i.name,
      brand: i.brand,
      qty: i.qty,
      price: i.final,
    })),
    total: data.total ?? data.items.reduce((n, i) => n + i.qty * i.final, 0),
    estado: "nuevo",
    notas: [],
  };
  try {
    await save("leads", lead);
    await logActivity(
      "lead",
      `Nueva cotización web — ${data.empresa || data.nombre}${data.pais ? ` (${data.pais})` : ""}`,
      lead.id,
    );
  } catch (e) {
    console.error("[cotizar] persist failed (email continues):", e);
  }

  /* ── email notification via Resend when configured ────────── */
  const resendKey = import.meta.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: import.meta.env.RESEND_FROM || "Cotizaciones <onboarding@resend.dev>",
          to: [SALES_EMAIL()],
          reply_to: data.email,
          subject: `Cotización ${data.items.length} equipos — ${data.nombre}${data.empresa ? ` (${data.empresa})` : ""}`,
          html: buildHtml(data),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error("[cotizar] email failed:", e);
    }
  } else {
    console.log(`[cotizar] LEAD guardado: ${data.nombre} <${data.email}> — ${data.items.length} items`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
