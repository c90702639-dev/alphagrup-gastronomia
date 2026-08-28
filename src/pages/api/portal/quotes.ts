import type { APIRoute } from "astro";
import { list, save, get, logActivity, newId } from "../../../lib/store";
import { ensureSeeded } from "../../../lib/seed";

export const prerender = false;

export interface QuoteRecord {
  id: string;
  folio: string;
  fecha: number;
  cliente: string;
  contacto: string;
  email?: string;
  items: { slug: string; name: string; brand: string; qty: number; price: number; descuento: number }[];
  subtotal: number;
  descuentoGlobal: number;
  total: number;
  estado: "borrador" | "enviada" | "aceptada" | "rechazada";
  demo?: boolean;
}

function authed(cookies: { get: (k: string) => { value: string } | undefined }) {
  return Boolean(cookies.get("ga_portal")?.value);
}

async function nextFolio(): Promise<string> {
  const all = await list<QuoteRecord>("quotes");
  const n = 1041 + all.length + 1;
  return `GA-${new Date().getFullYear()}-${n}`;
}

function computeTotal(items: QuoteRecord["items"], descGlobal: number): { subtotal: number; total: number } {
  const subtotal = items.reduce((n, it) => {
    const line = it.qty * it.price * (1 - (it.descuento || 0) / 100);
    return n + Math.round(line);
  }, 0);
  const total = Math.round(subtotal * (1 - descGlobal / 100));
  return { subtotal, total };
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });
  await ensureSeeded();
  return new Response(JSON.stringify(await list<QuoteRecord>("quotes")), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });

  const body = await request.json().catch(() => null) as Partial<QuoteRecord> | null;
  if (!body?.items?.length)
    return new Response(JSON.stringify({ error: "items requeridos" }), { status: 400 });

  const items = body.items.map((it) => ({
    slug: it.slug,
    name: it.name,
    brand: it.brand,
    qty: Math.max(1, Number(it.qty) || 1),
    price: Number(it.price) || 0,
    descuento: Math.min(50, Math.max(0, Number(it.descuento) || 0)),
  }));
  const descuentoGlobal = Math.min(30, Math.max(0, Number(body.descuentoGlobal) || 0));
  const { subtotal, total } = computeTotal(items, descuentoGlobal);

  const quote: QuoteRecord = {
    id: newId("qt"),
    folio: await nextFolio(),
    fecha: Date.now(),
    cliente: body.cliente?.trim() || "Cliente sin nombre",
    contacto: body.contacto?.trim() || "",
    email: body.email?.trim() || undefined,
    items,
    subtotal,
    descuentoGlobal,
    total,
    estado: "borrador",
  };

  await save("quotes", quote);
  await logActivity("quote", `Cotización ${quote.folio} creada — ${quote.cliente}`);
  return new Response(JSON.stringify(quote), {
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; estado?: string } | null;
  if (!body?.id || !body.estado)
    return new Response(JSON.stringify({ error: "id y estado requeridos" }), { status: 400 });

  const quote = await get<QuoteRecord>("quotes", body.id);
  if (!quote) return new Response(JSON.stringify({ error: "no encontrada" }), { status: 404 });

  if (["borrador", "enviada", "aceptada", "rechazada"].includes(body.estado)) {
    quote.estado = body.estado as QuoteRecord["estado"];
    if (body.estado === "enviada")
      await logActivity("quote", `Cotización ${quote.folio} enviada a ${quote.cliente}`, quote.id);
    if (body.estado === "aceptada")
      await logActivity("win", `🎉 Cotización ${quote.folio} ACEPTADA — ${quote.cliente}`, quote.id);
    await save("quotes", quote);
  }

  return new Response(JSON.stringify(quote), {
    headers: { "Content-Type": "application/json" },
  });
};
