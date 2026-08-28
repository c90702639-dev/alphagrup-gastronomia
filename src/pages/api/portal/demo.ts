import type { APIRoute } from "astro";
import { ensureSeeded, purgeDemo } from "../../../lib/seed";

export const prerender = false;

/** GET: seed if needed (idempotent). POST: purge demo items. */
export const GET = async () => {
  await ensureSeeded();
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST = async () => {
  const counts = await purgeDemo();
  return new Response(JSON.stringify({ ok: true, counts }), {
    headers: { "Content-Type": "application/json" },
  });
};
