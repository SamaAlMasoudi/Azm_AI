/* Azm — unified AI provider registry.
 *
 * One place that knows every provider Azm can talk to: how to authenticate,
 * which endpoint to hit, which models are worth suggesting, and — honestly —
 * what using it costs (included / free tier / local / paid).
 *
 * Adding a future provider = add one entry here (+ a protocol branch in
 * llm.ts if it isn't OpenAI-compatible). Nothing else changes.
 */

export type ProviderId = "builtin" | "openai" | "anthropic" | "groq" | "ollama" | "off";

/** Honest cost class, surfaced in the settings UI. */
export type ProviderTier = "included" | "free_tier" | "local" | "paid" | "none";

export type ModelTier = "free_tier" | "local" | "paid";

export interface ModelInfo {
  id: string;
  /** optional human label (falls back to the id) */
  label?: string;
  tier: ModelTier;
}

export interface ProviderMeta {
  id: ProviderId;
  tier: ProviderTier;
  /** true when a request without credentials can never work */
  requiresKey: boolean;
  /** whether the base URL is user-editable (self-hosted / compatible gateways) */
  supportsBaseUrl: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  /** curated suggestions; the live list can also be fetched at runtime */
  models: ModelInfo[];
  /** short, non-marketing setup hint shown under the provider picker */
  hint: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  builtin: {
    id: "builtin",
    tier: "included",
    requiresKey: false,
    supportsBaseUrl: false,
    defaultBaseUrl: "",
    defaultModel: "zai",
    models: [{ id: "zai", tier: "free_tier", label: "Built-in model" }],
    hint: "Included with Azm. No account, no key — usage limits are handled for you.",
  },
  groq: {
    id: "groq",
    tier: "free_tier",
    requiresKey: true,
    // Base URL is editable because Groq's edge (Cloudflare) blocks some
    // server networks (unsupported regions / datacenter IP ranges) BEFORE
    // authentication — those networks can only reach Groq through an
    // OpenAI-compatible relay the user controls.
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    // Officially supported Groq model ID (note the required "openai/" prefix
    // — stripping it makes the model not found on Groq's API).
    defaultModel: "openai/gpt-oss-20b",
    // Curated well-known models on Groq's OpenAI-compatible API. The live
    // list is fetchable at runtime (GET /models), so this is a starting
    // point, not a claim about current availability.
    models: [
      { id: "llama-3.3-70b-versatile", tier: "free_tier" },
      { id: "llama-3.1-8b-instant", tier: "free_tier" },
      { id: "openai/gpt-oss-120b", tier: "free_tier" },
      { id: "openai/gpt-oss-20b", tier: "free_tier" },
      { id: "qwen/qwen3-32b", tier: "free_tier" },
      { id: "moonshotai/kimi-k2-instruct", tier: "free_tier" },
      { id: "deepseek-r1-distill-llama-70b", tier: "free_tier" },
    ],
    hint: "Free tier with rate limits. Create a key at console.groq.com — the key stays on the server. If Groq's edge blocks this server's network, point the Base URL at an OpenAI-compatible Groq relay you control.",
  },
  ollama: {
    id: "ollama",
    tier: "local",
    requiresKey: false,
    supportsBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    models: [
      { id: "llama3.2", tier: "local" },
      { id: "llama3.1", tier: "local" },
      { id: "qwen2.5", tier: "local" },
      { id: "gemma3", tier: "local" },
      { id: "phi4", tier: "local" },
    ],
    hint: "Runs on your machine — fully free and private. Requires an installed Ollama server (ollama.com) and a pulled model.",
  },
  openai: {
    id: "openai",
    tier: "paid",
    requiresKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", tier: "paid" },
      { id: "gpt-4o", tier: "paid" },
    ],
    hint: "Paid API. Bring your own key; any OpenAI-compatible gateway works via the base URL.",
  },
  anthropic: {
    id: "anthropic",
    tier: "paid",
    requiresKey: true,
    supportsBaseUrl: false,
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-haiku-4-5",
    models: [
      { id: "claude-haiku-4-5", tier: "paid" },
      { id: "claude-sonnet-4-5", tier: "paid" },
    ],
    hint: "Paid API. Bring your own key from console.anthropic.com.",
  },
  off: {
    id: "off",
    tier: "none",
    requiresKey: false,
    supportsBaseUrl: false,
    defaultBaseUrl: "",
    defaultModel: "",
    models: [],
    hint: "No AI calls. Every decision falls back to honest local rules marked as such.",
  },
};

/** Providers the settings UI shows, in display order. */
export const PROVIDER_ORDER: ProviderId[] = ["builtin", "groq", "ollama", "openai", "anthropic", "off"];

export function isProviderId(raw: unknown): raw is ProviderId {
  return typeof raw === "string" && raw in PROVIDERS;
}

export function providerMeta(id: string): ProviderMeta {
  return PROVIDERS[(isProviderId(id) ? id : "builtin") as ProviderId];
}

/** OpenAI-compatible chat protocol providers (one implementation serves all). */
export function isOpenAiCompatible(id: ProviderId): boolean {
  return id === "openai" || id === "groq" || id === "ollama";
}

export function effectiveBaseUrl(meta: ProviderMeta, userBaseUrl: string): string {
  const base = (userBaseUrl.trim() || meta.defaultBaseUrl).replace(/\/+$/, "");
  if (!base) return "";
  const withScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`;
  return meta.id === "ollama"
    ? normalizeOllamaUrl(withScheme)
    : meta.id === "groq"
      ? normalizeGroqUrl(withScheme)
      : withScheme;
}

/**
 * Normalize a Groq base URL, making the two most common paste mistakes
 * structurally impossible:
 *  1. Pasting the FULL endpoint (`…/v1/chat/completions`) as a base URL —
 *     llm.ts appends `/chat/completions` itself, so the pasted suffix is
 *     stripped to avoid `…/chat/completions/chat/completions`.
 *  2. Pasting `https://api.groq.com` or `https://api.groq.com/openai` —
 *     both miss the canonical `/openai/v1` surface and would 404, so the
 *     canonical path is completed for the official host only.
 * Custom relay hosts are preserved verbatim (only the pasted suffix is
 * stripped), so relay base URLs keep working unchanged.
 */
export function normalizeGroqUrl(url: string): string {
  const stripped = url.replace(/\/+$/, "").replace(/\/chat\/completions$/i, "").replace(/\/+$/, "");
  try {
    const u = new URL(stripped);
    if (u.hostname.toLowerCase() === "api.groq.com") {
      const p = u.pathname.replace(/\/+$/, "").toLowerCase();
      if (!p || p === "/openai") u.pathname = "/openai/v1";
    }
    return u.toString().replace(/\/+$/, "");
  } catch {
    return stripped;
  }
}

/**
 * Normalize an Ollama base URL to its OpenAI-compatible surface, fixing the
 * two most common real-world connection failures:
 *  1. `localhost` resolving to ::1 first while Ollama binds 127.0.0.1 —
 *     rewriting to 127.0.0.1 removes that failure class entirely.
 *  2. Setup guides give `http://localhost:11434` (no /v1), which would make
 *     every request hit /chat/completions on the root and 404 — /v1 is
 *     appended automatically when missing.
 * The user's explicit host/port is otherwise preserved (remote hosts work).
 */
export function normalizeOllamaUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "localhost") u.hostname = "127.0.0.1";
    const path = u.pathname.replace(/\/+$/, "");
    u.pathname = path.endsWith("/v1") ? path : `${path}/v1`;
    return u.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}
