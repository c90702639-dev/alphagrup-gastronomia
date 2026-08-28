import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Unified storage: Netlify Blobs in production, JSON files in dev.
 * Auto-detected via NETLIFY env var. Same async API for both drivers.
 *
 * Collections:
 *   leads    — RFQ submissions from the public site
 *   quotes   — quotes created in the builder
 *   activity — event feed
 *   docs     — registry of ingested documents
 *   kb       — runtime knowledge base (chunks appended by uploads)
 *   meta     — internal flags (seeded, etc.)
 */

export type CollectionName =
  | "leads"
  | "quotes"
  | "activity"
  | "docs"
  | "kb"
  | "meta";

const isNetlify = () => Boolean(process.env.NETLIFY);

/* ── id helper ─────────────────────────────────────────────── */
export function newId(prefix = ""): string {
  const id = crypto.randomUUID().slice(0, 12);
  return prefix ? `${prefix}_${id}` : id;
}

/* ── dev driver (JSON files) ───────────────────────────────── */

const DEV_DIR = path.resolve(".data");

async function devRead(name: CollectionName): Promise<unknown[]> {
  try {
    return JSON.parse(await readFile(path.join(DEV_DIR, `${name}.json`), "utf8"));
  } catch {
    return [];
  }
}

async function devWrite(name: CollectionName, items: unknown[]): Promise<void> {
  await mkdir(DEV_DIR, { recursive: true });
  await writeFile(
    path.join(DEV_DIR, `${name}.json`),
    JSON.stringify(items, null, 1),
    "utf8",
  );
}

/* ── prod driver (Netlify Blobs) ───────────────────────────── */

type BlobsModule = typeof import("@netlify/blobs");
let blobsPromise: Promise<BlobsModule> | null = null;

function blobs(): Promise<BlobsModule> {
  if (!blobsPromise) blobsPromise = import("@netlify/blobs");
  return blobsPromise;
}

async function prodRead(name: CollectionName): Promise<unknown[]> {
  const { getStore } = await blobs();
  const store = getStore({ name: "portal", consistency: "strong" });
  try {
    const raw = await store.get(`col:${name}`, { type: "json" });
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function prodWrite(name: CollectionName, items: unknown[]): Promise<void> {
  const { getStore } = await blobs();
  const store = getStore({ name: "portal", consistency: "strong" });
  await store.setJSON(`col:${name}`, items);
}

/* ── public API ────────────────────────────────────────────── */

export async function list<T>(name: CollectionName): Promise<T[]> {
  const items = isNetlify() ? await prodRead(name) : await devRead(name);
  return items as T[];
}

export async function save<T extends { id: string }>(
  name: CollectionName,
  item: T,
): Promise<T> {
  const items = await list<T>(name);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  await writeAll(name, items);
  return item;
}

export async function get<T extends { id: string }>(
  name: CollectionName,
  id: string,
): Promise<T | undefined> {
  return (await list<T>(name)).find((i) => i.id === id);
}

export async function remove(
  name: CollectionName,
  id: string,
): Promise<void> {
  await writeAll(name, (await list(name)).filter((i: any) => i.id !== id));
}

export async function writeAll(
  name: CollectionName,
  items: unknown[],
): Promise<void> {
  if (isNetlify()) await prodWrite(name, items);
  else await devWrite(name, items);
}

/** Append an activity event (keeps last 100). */
export async function logActivity(tipo: string, texto: string, ref?: string): Promise<void> {
  await save("activity", {
    id: newId("act"),
    ts: Date.now(),
    tipo,
    texto,
    ref,
  });
  const all = await list("activity");
  if (all.length > 100) await writeAll("activity", all.slice(0, 100));
}
