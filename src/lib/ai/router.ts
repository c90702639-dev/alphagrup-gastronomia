import { apiKeys, chatCascade, type ModelSpec } from "./config";

/**
 * OpenRouter router: round-robin across N keys × cascade across M models.
 * A request tries (key, model) combos until one succeeds.
 *
 * Failure policy:
 *  - 429 / 5xx / network error → try next model with next key
 *  - 400/401 → key/model misconfigured, skip that combo too but log loudly
 */

export interface RouteAttempt {
  keyIndex: number;
  model: string;
  status: number;
  ms: number;
  ok: boolean;
}

export interface RouteResult {
  response: Response | null;
  attempts: RouteAttempt[];
  usedKey: number;
  usedModel: string;
}

let rrCounter = 0;

/** Models benched temporarily after failures (in-function-instance memory). */
const benched = new Map<string, number>(); // model → until-ts
const BENCH_MS = 60_000;
const MAX_ATTEMPTS = 8;

function isBenched(model: string): boolean {
  const until = benched.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    benched.delete(model);
    return false;
  }
  return true;
}

function bench(model: string) {
  benched.set(model, Date.now() + BENCH_MS);
}

export async function routeChat(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const keys = apiKeys();
  if (!keys.length) throw new Error("OPENROUTER_KEYS no configurada");

  let models = chatCascade().filter((m) => !isBenched(m.id));
  if (!models.length) {
    // everything benched — unbench all and retry full list
    benched.clear();
    models = chatCascade();
  }

  const attempts: RouteAttempt[] = [];
  const maxAttempts = Math.min(MAX_ATTEMPTS, keys.length * models.length);

  for (let i = 0; i < maxAttempts; i++) {
    const spec: ModelSpec | undefined = models[i % models.length];
    if (!spec) break;
    const keyIndex = (rrCounter + i) % keys.length;
    const t0 = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${keys[keyIndex]}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://grupoalpha.com",
          "X-Title": "Grupo Alpha Portal",
        },
        body: JSON.stringify({ ...body, model: spec.id }),
      });

      const ok = res.ok;
      attempts.push({
        keyIndex,
        model: spec.id,
        status: res.status,
        ms: Date.now() - t0,
        ok,
      });

      if (ok) {
        rrCounter++; // advance rotation for next request
        return { response: res, attempts, usedKey: keyIndex, usedModel: spec.id };
      }

      // rate limited or server issue → bench this model briefly
      if (res.status === 429 || res.status >= 500) bench(spec.id);
      else if (res.status === 401 || res.status === 402)
        console.error(`[ai-router] key #${keyIndex} problem: ${res.status}`);
    } catch (e) {
      attempts.push({
        keyIndex,
        model: spec.id,
        status: 0,
        ms: Date.now() - t0,
        ok: false,
      });
      bench(spec.id);
    }
  }

  return { response: null, attempts, usedKey: -1, usedModel: "none" };
}
