import { loadKb, invalidateKbCache, type Chunk } from "./kb";

/**
 * Retrieval over the knowledge base.
 * Primary: cosine similarity (MiniLM query embedding vs chunk vectors).
 * Fallback: lexical BM25-lite when embeddings unavailable.
 */

export interface Hit {
  chunk: Chunk;
  score: number;
}

export interface RetrievalResult {
  hits: Hit[];
  mode: "semantic" | "lexical";
}

/* ── vector helpers ─────────────────────────────────────────── */

function b64ToFloat32(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const decoded = new Map<string, Float32Array>();
function vecOf(c: Chunk): Float32Array | undefined {
  if (!c.vec) return undefined;
  let v = decoded.get(c.id);
  if (!v) {
    v = b64ToFloat32(c.vec);
    decoded.set(c.id, v);
  }
  return v;
}

export function f32ToB64(arr: ArrayLike<number>): string {
  const f = new Float32Array(arr);
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString("base64");
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/* ── query embedding (lazy singleton) ───────────────────────── */

type EmbedFn = (text: string) => Promise<Float32Array>;
let embedder: Promise<EmbedFn> | null = null;

async function getEmbedder(): Promise<EmbedFn> {
  const { pipeline } = await import("@huggingface/transformers");
  const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  });
  return async (text: string) => {
    const out = await pipe(text, { pooling: "mean", normalize: true });
    return out.data as Float32Array;
  };
}

/** Embed a single text — used by retrieval AND the upload endpoint. */
export async function embedText(text: string): Promise<Float32Array> {
  if (!embedder)
    embedder = getEmbedder().catch((e) => {
      embedder = null;
      throw e;
    });
  const embed = await embedder;
  return embed(text);
}

/* ── lexical fallback (BM25-lite) ───────────────────────────── */

const STOP = new Set([
  "de","la","el","y","en","que","los","del","las","un","una","con","para","es",
  "por","su","al","lo","como","mas","o","se","the","of","and","a","to","in",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9ñ°"]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

let lexIndex: { df: Map<string, number>; docs: Map<string, Map<string, number>>; n: number } | null = null;
let lexAt = 0;

async function lexicalIndex() {
  if (lexIndex && Date.now() - lexAt < 30_000) return lexIndex;
  const kb = await loadKb();
  const df = new Map<string, number>();
  const docs = new Map<string, Map<string, number>>();
  for (const c of kb.chunks) {
    const tt = tokens(`${c.product || ""} ${c.brand || ""} ${c.source} ${c.text}`);
    const tf = new Map<string, number>();
    for (const t of tt) tf.set(t, (tf.get(t) || 0) + 1);
    docs.set(c.id, tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  }
  lexIndex = { df, docs, n: kb.chunks.length };
  lexAt = Date.now();
  return lexIndex;
}

async function lexicalScores(query: string): Promise<Map<string, number>> {
  const idx = await lexicalIndex();
  const q = tokens(query);
  const scores = new Map<string, number>();
  for (const [id, tf] of idx.docs) {
    let s = 0;
    for (const term of q) {
      const f = tf.get(term);
      if (!f) continue;
      const idf = Math.log(1 + idx.n / (1 + (idx.df.get(term) || 0)));
      s += idf * (f / (f + 1.2));
    }
    if (s > 0) scores.set(id, s);
  }
  return scores;
}

/* ── public API ─────────────────────────────────────────────── */

export async function retrieve(query: string, k = 6): Promise<RetrievalResult> {
  const kb = await loadKb();

  // semantic first
  try {
    const qv = await embedText(query);
    const scored: Hit[] = [];
    for (const c of kb.chunks) {
      const v = vecOf(c);
      if (v && v.length === qv.length) scored.push({ chunk: c, score: cosine(qv, v) });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, k).filter((h) => h.score > 0.25);
    if (top.length) return { hits: top, mode: "semantic" };
  } catch (e) {
    console.warn("[retrieval] semantic failed → lexical:", (e as Error).message);
  }

  const scores = await lexicalScores(query);
  const byId = new Map(kb.chunks.map((c) => [c.id, c]));
  const hits = [...scores.entries()]
    .map(([id, score]) => ({ chunk: byId.get(id)!, score }))
    .filter((h) => h.chunk)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return { hits, mode: "lexical" };
}

export async function kbStats() {
  const kb = await loadKb();
  const sources = new Set(kb.chunks.map((c) => c.source));
  return {
    chunks: kb.chunks.length,
    sources: sources.size,
    generatedAt: kb.generatedAt,
    model: kb.model,
  };
}

export { loadKb, invalidateKbCache };
