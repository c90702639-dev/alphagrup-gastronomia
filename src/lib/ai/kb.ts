import staticKb from "../../data/kb.json";
import { list } from "../store";

/**
 * Knowledge base loading: bundled build-time index + runtime uploads.
 * - Dev: uploaded chunks persist in .data/kb.json via the store
 * - Prod: Netlify Blobs collection "kb"
 * - Static import is always merged in as the base layer.
 */

export interface Chunk {
  id: string;
  source: string;
  page?: number;
  product?: string;
  brand?: string;
  text: string;
  /** base64-encoded Float32 vector */
  vec?: string;
  docId?: string;
}

export interface KB {
  generatedAt: string;
  model: string;
  dim: number;
  chunks: Chunk[];
}

const static_ = staticKb as unknown as KB;

let cache: { kb: KB; at: number } | null = null;
const TTL = 30_000; // re-check store every 30s max

export async function loadKb(): Promise<KB> {
  if (cache && Date.now() - cache.at < TTL) return cache.kb;

  const runtimeChunks = await list<Chunk>("kb");
  const kb: KB = {
    generatedAt: static_.generatedAt,
    model: static_.model,
    dim: static_.dim,
    chunks: [...static_.chunks, ...runtimeChunks],
  };
  cache = { kb, at: Date.now() };
  return kb;
}

/** Invalidate cache after an upload/delete. */
export function invalidateKbCache(): void {
  cache = null;
}
