import type { APIRoute } from "astro";
import { list, save, get, logActivity } from "../../../lib/store";
import type { Lead } from "../../../lib/seed";
import { ensureSeeded } from "../../../lib/seed";

export const prerender = false;

const ESTADOS = ["nuevo", "contactado", "cotizada", "ganado", "perdido"];

function authed(cookies: { get: (k: string) => { value: string } | undefined }) {
  // light check — full validation lives in auth.ts but avoid circular import cost here
  return Boolean(cookies.get("ga_portal")?.value);
}

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });
  await ensureSeeded();

  const estado = url.searchParams.get("estado");
  let leads = await list<Lead>("leads");

  if (estado && ESTADOS.includes(estado)) {
    leads = leads.filter((l) => l.estado === estado);
  }
  return new Response(JSON.stringify(leads), {
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });

  const body = await request.json().catch(() => null) as
    | { id?: string; estado?: string; nota?: string }
    | null;
  if (!body?.id) return new Response(JSON.stringify({ error: "id requerido" }), { status: 400 });

  const lead = await get<Lead>("leads", body.id);
  if (!lead) return new Response(JSON.stringify({ error: "no encontrado" }), { status: 404 });

  if (body.estado) {
    if (!ESTADOS.includes(body.estado))
      return new Response(JSON.stringify({ error: "estado inválido" }), { status: 400 });
    lead.estado = body.estado as Lead["estado"];
    if (body.estado === "ganado")
      await logActivity("win", `🎉 Trato GANADO — ${lead.empresa || lead.nombre}`, lead.id);
  }
  if (body.nota?.trim()) {
    lead.notas.unshift({ ts: Date.now(), texto: body.nota.trim() });
  }

  await save("leads", lead);
  return new Response(JSON.stringify(lead), {
    headers: { "Content-Type": "application/json" },
  });
};
