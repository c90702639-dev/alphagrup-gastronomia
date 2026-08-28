/**
 * AI model configuration — fully switchable without code changes.
 *
 * HOW IT WORKS
 * ────────────
 * • Keys: set OPENROUTER_KEYS="sk-or-v1-xxx,sk-or-v1-yyy,sk-or-v1-zzz"
 *   (comma-separated). The router rotates across them round-robin and
 *   fails over automatically. One key = same behavior, no code change.
 *
 * • Models: the cascade is tried in order per request. If a model is
 *   rate-limited (429) or errors, the next one answers. All defaults are
 *   FREE models on OpenRouter.
 */

export interface ModelSpec {
  id: string;
  label: string;
}

/** Chat cascade — order matters. All free tier. */
export const CHAT_CASCADE: ModelSpec[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B" },
  { id: "google/gemini-2.0-flash-exp:free", label: "Gemini Flash" },
  { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B" },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", label: "Mistral Small 3.2" },
  { id: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3" },
];

/** Override cascade via env, e.g. CHAT_MODELS="openai/gpt-4o-mini,meta-llama/llama-3.3-70b-instruct:free" */
export function chatCascade(): ModelSpec[] {
  const envList = import.meta.env.CHAT_MODELS as string | undefined;
  if (envList) {
    return envList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => ({ id, label: id }));
  }
  return CHAT_CASCADE;
}

/** OpenRouter API keys — rotation handled by the router. */
export function apiKeys(): string[] {
  const raw =
    (import.meta.env.OPENROUTER_KEYS as string | undefined) ||
    (import.meta.env.OPENROUTER_API_KEY as string | undefined) ||
    "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}
