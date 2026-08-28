/**
 * Knowledge-base ingestion.
 *
 * 1. Reads every PDF in ./docs (recursive) → extracts text with page numbers
 * 2. Seeds chunks from src/data/products.json specs (so the AI works day 1)
 * 3. Chunks text (~1100 chars, 150 overlap, section-aware)
 * 4. Embeds with MiniLM (local, free) → base64 Float32
 * 5. Writes src/data/kb.json
 *
 * Run:  node scripts/ingest-docs.mjs
 */
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

/* ── pdf text extraction (unpdf = serverless-friendly pdf.js) ── */

async function extractPdf(file) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const buf = await readFile(file);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  // text: string[] — one entry per page
  return text;
}

/* ── chunking ───────────────────────────────────────────────── */

function chunkText(text, size = 1100, overlap = 150) {
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

/* ── embeddings ─────────────────────────────────────────────── */

async function getPipe() {
  const { pipeline } = await import("@huggingface/transformers");
  return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  });
}

function f32ToB64(arr) {
  return Buffer.from(
    new Float32Array(arr).buffer,
    new Float32Array(arr).byteOffset,
    new Float32Array(arr).byteLength,
  ).toString("base64");
}

/* ── main ───────────────────────────────────────────────────── */

const BRANDS = [
  "Rational","Cook Rite","Hoshizaki","Winterhalter","Meiko","Cambro",
  "Snack Pro","Atosa","Roboqbo","Hidronix","Parker","Alpha","Spaceman",
];

async function* walk(dir) {
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) yield* walk(p);
      else if (e.name.toLowerCase().endsWith(".pdf")) yield p;
    }
  } catch {
    /* docs folder may not exist yet */
  }
}

async function main() {
  console.log("Loading embedding model…");
  const pipe = await getPipe();
  const embed = async (t) => {
    const r = await pipe(t, { pooling: "mean", normalize: true });
    return r.data;
  };

  const chunks = [];
  let n = 0;

  async function add(text, meta) {
    const pieces = chunkText(text);
    for (let i = 0; i < pieces.length; i++) {
      const v = await embed(pieces[i]);
      chunks.push({
        id: `${meta.source}-${i}-${n++}`,
        source: meta.source,
        page: meta.page,
        product: meta.product,
        brand: meta.brand,
        text: pieces[i],
        vec: f32ToB64(v),
      });
    }
  }

  // ── 1) seed from product specs (day-1 knowledge) ────────────
  console.log("Seeding from product data…");
  const db = JSON.parse(await readFile("src/data/products.json", "utf8"));
  for (const p of db.products) {
    const specLines = Object.entries(p.specs || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    const text = [
      `Producto: ${p.name}.`,
      `Marca: ${p.brand}. Categoría: ${p.category}. División: ${p.division}.`,
      specLines && `Especificaciones técnicas — ${specLines}.`,
      `Modelo/referencia: ${p.slug}.`,
    ]
      .filter(Boolean)
      .join(" ");
    await add(text, {
      source: `catalogo/${p.slug}`,
      product: p.name,
      brand: p.brand,
    });
  }

  // ── 2) ingest real PDFs from ./docs ─────────────────────────
  let pdfCount = 0;
  for await (const file of walk("docs")) {
    pdfCount++;
    console.log(`PDF: ${file}`);
    try {
      const pages = await extractPdf(file);
      const base = path.basename(file, ".pdf");
      const brandGuess =
        BRANDS.find((b) => base.toLowerCase().includes(b.toLowerCase())) ||
        undefined;
      for (let pg = 0; pg < pages.length; pg++) {
        const raw = (pages[pg] || "").replace(/\s+/g, " ").trim();
        if (!raw) continue;
        await add(raw, {
          source: `docs/${base}`,
          page: pg + 1,
          brand: brandGuess,
        });
      }
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
  }

  const kb = {
    generatedAt: new Date().toISOString(),
    model: "Xenova/all-MiniLM-L6-v2",
    dim: 384,
    chunks,
  };
  await writeFile("src/data/kb.json", JSON.stringify(kb));
  const mb = (Buffer.byteLength(JSON.stringify(kb)) / 1024 / 1024).toFixed(1);
  console.log(
    `\n✓ kb.json: ${chunks.length} chunks (${mb} MB) — ${db.products.length} products + ${pdfCount} PDFs`,
  );
}

main();
