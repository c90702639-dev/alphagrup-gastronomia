import type { APIRoute } from "astro";
import { save, list, remove, newId, logActivity, writeAll } from "../../../lib/store";
import {
  embedText,
  f32ToB64,
  loadKb,
  invalidateKbCache,
} from "../../../lib/ai/retrieval";
import type { Chunk } from "../../../lib/ai/kb";

export const prerender = false;

const BRANDS = [
  "Rational","Cook Rite","Hoshizaki","Winterhalter","Meiko","Cambro",
  "Snack Pro","Atosa","Roboqbo","Hidronix","Parker","Alpha","Spaceman",
];

function chunkText(text: string, size = 1100, overlap = 150): string[] {
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const cut = text.lastIndexOf("\n", end);
      const dot = text.lastIndexOf(". ", end);
      if (cut > i + size * 0.5) end = cut + 1;
      else if (dot > i + size * 0.5) end = dot + 1;
    }
    const piece = text.slice(i, end).replace(/\s+/g, " ").trim();
    if (piece.length > 60) out.push(piece);
    if (end >= text.length) break;
    i = end - overlap;
  }
  return out;
}

function authed(cookies: { get: (k: string) => { value: string } | undefined }) {
  return Boolean(cookies.get("ga_portal")?.value);
}

/** GET: list ingested docs. */
export const GET: APIRoute = async ({ cookies }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });
  const docs = await list<DocRecord>("docs");
  return new Response(JSON.stringify(docs), {
    headers: { "Content-Type": "application/json" },
  });
};

export interface DocRecord {
  id: string;
  name: string;
  chars: number;
  chunks: number;
  addedAt: number;
  demo?: boolean;
}

/** POST: multipart upload → parse → chunk → embed → append to KB. */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return new Response(JSON.stringify({ error: "Archivo requerido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return new Response(JSON.stringify({ error: "Solo PDF por ahora" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // extract text per page
  let pages: string[];
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    ({ text: pages } = await extractText(pdf, { mergePages: false }));
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `No se pudo leer el PDF: ${(e as Error).message}` }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const docId = newId("doc");
  const base = file.name.replace(/\.pdf$/i, "");
  const brandGuess =
    BRANDS.find((b) => base.toLowerCase().includes(b.toLowerCase())) || undefined;

  // chunk + embed
  const runtimeChunks: Chunk[] = [];
  let chars = 0;
  let embedFails = 0;

  for (let pg = 0; pg < pages.length; pg++) {
    const raw = (pages[pg] || "").replace(/\s+/g, " ").trim();
    if (!raw) continue;
    chars += raw.length;
    for (const piece of chunkText(raw)) {
      let vecB64: string | undefined;
      try {
        vecB64 = f32ToB64(await embedText(piece));
      } catch {
        embedFails++;
      }
      runtimeChunks.push({
        id: `${docId}-${pg}-${runtimeChunks.length}`,
        source: `docs/${base}`,
        page: pg + 1,
        brand: brandGuess,
        text: piece,
        vec: vecB64,
        docId,
      });
    }
  }

  await writeAll("kb", [...(await list<Chunk>("kb")), ...runtimeChunks]);
  invalidateKbCache();

  const record: DocRecord = {
    id: docId,
    name: file.name,
    chars,
    chunks: runtimeChunks.length,
    addedAt: Date.now(),
  };
  await save("docs", record);
  await logActivity("doc", `Ficha técnica indexada: ${file.name} (${runtimeChunks.length} fragmentos)`);

  return new Response(
    JSON.stringify({
      ok: true,
      docId,
      pages: pages.filter((p) => p?.trim()).length,
      chunks: runtimeChunks.length,
      embedFails,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};

/** DELETE: ?id= — removes doc and its chunks from the KB. */
export const DELETE: APIRoute = async ({ cookies, url }) => {
  if (!authed(cookies)) return new Response("No autorizado", { status: 401 });
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "id requerido" }), {
    status: 400, headers: { "Content-Type": "application/json" },
  });

  const kb = await loadKb();
  const remaining = kb.chunks.filter((c) => c.docId !== id);
  await writeAll("kb", remaining);
  await remove("docs", id);
  invalidateKbCache();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
