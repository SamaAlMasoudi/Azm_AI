/* Azm — server LLM layer with a unified multi-provider interface.
 *
 * Default provider is the built-in Z.AI SDK. Students may bring their own
 * provider — Groq (free tier), a local Ollama server, an OpenAI-compatible
 * gateway or Anthropic — with model + API key from Settings; keys never
 * leave the server. All decisions parse strict JSON, and every call site has
 * an honest heuristic fallback when AI is "off", unconfigured, or fails.
 *
 * Adding a new provider: add metadata in providers.ts; if it speaks the
 * OpenAI-compatible chat protocol it needs no new branch here.
 */

import ZAI from "z-ai-web-dev-sdk";
import type { Profile } from "@prisma/client";
import { effectiveBaseUrl, isOpenAiCompatible, providerMeta, type ProviderId } from "./providers";

export type AiProviderKind = ProviderId;

export interface ProviderConfig {
  kind: AiProviderKind;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

export function resolveProvider(
  p: Pick<Profile, "aiProvider" | "aiModel" | "aiBaseUrl" | "aiApiKey">
): ProviderConfig | null {
  const id = providerMeta(p.aiProvider).id;
  if (id === "off") return null;
  if (id === "builtin") {
    return { kind: "builtin", apiKey: "", model: "zai", baseUrl: "" };
  }
  const meta = providerMeta(id);
  if (meta.requiresKey && !p.aiApiKey) return null;
  const baseUrl = effectiveBaseUrl(meta, p.aiBaseUrl);
  if (!baseUrl) return null;
  return {
    kind: id,
    apiKey: meta.requiresKey ? p.aiApiKey : "",
    model: p.aiModel.trim() || meta.defaultModel,
    baseUrl,
  };
}

class ProviderError extends Error {
  /** Provider HTTP status, set when the error was built from a response. */
  status?: number;
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

interface ProviderErrorBody {
  code: string;
  message: string;
}

/** Extract {code,message} from an OpenAI-style error body (Groq and friends
 *  return {"error":{"code":"…","message":"…"}}) — empty strings if absent. */
function parseProviderError(body: string): ProviderErrorBody {
  try {
    const j = JSON.parse(body) as { error?: { code?: unknown; message?: unknown } };
    const err = j?.error;
    if (err && typeof err === "object") {
      return {
        code: typeof err.code === "string" ? err.code : "",
        message: typeof err.message === "string" ? err.message : "",
      };
    }
  } catch {
    /* non-JSON body */
  }
  return { code: "", message: "" };
}

/** Defense in depth: provider error text must never carry a secret. */
export function scrubSecrets(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "sk-ant-***")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***")
    .replace(/gsk_[A-Za-z0-9_-]{8,}/g, "gsk_***");
}

export type UnifiedClassification = "relevant" | "ambiguous" | "distracting";
export type UnifiedDecision = "allow" | "challenge" | "grant" | "close";
export interface UnifiedEvaluation {
  classification: UnifiedClassification;
  decision: UnifiedDecision;
  minutes: number;
  confidence: number;
  message: string;
}

/** Strict provider-independent contract used at the extension boundary. */
export function normalizeUnifiedEvaluation(raw: Record<string, unknown> | null | undefined): UnifiedEvaluation | null {
  if (!raw) return null;
  const classification = String(raw.classification ?? "");
  const decision = String(raw.decision ?? "");
  if (!["relevant", "ambiguous", "distracting"].includes(classification)) return null;
  if (!["allow", "challenge", "grant", "close"].includes(decision)) return null;
  const message = scrubSecrets(String(raw.message ?? "")).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 500);
  if (!message) return null;
  return { classification: classification as UnifiedClassification, decision: decision as UnifiedDecision, minutes: Math.max(0, Math.min(60, Math.round(Number(raw.minutes) || 0))), confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)), message };
}

/** The built-in Z.AI model only works where the SDK has its config (.z-ai-config). */
function builtinError(e: unknown): Error {
  if (e instanceof ProviderError) return e;
  const msg = (e as Error)?.message ?? "";
  if (/configuration file not found|\.z-ai-config|invalid/i.test(msg) && /config/i.test(msg)) {
    return new ProviderError(
      "The built-in model is not available on this server: the Z.AI SDK has no .z-ai-config (project folder, home directory or /etc). It is only provisioned on Z.ai hosting — pick Groq, OpenAI, Anthropic or Ollama with your own key instead."
    );
  }
  if (/timeout/i.test(msg)) {
    return new ProviderError("The built-in model did not answer within 15 s — try again, or pick another provider.");
  }
  return new ProviderError(`The built-in model failed: ${scrubSecrets(msg).slice(0, 200) || "unknown error"}`);
}

function describeHttpError(status: number, body: string, provider: ProviderId): Error {
  const { code, message } = parseProviderError(body);
  const detail = scrubSecrets(message || body).slice(0, 200);
  // Every error built here carries the provider HTTP status so callers can
  // refine ambiguous cases (see refineGroqError).
  const fail = (msg: string) => {
    const e = new ProviderError(msg);
    e.status = status;
    return e;
  };

  if (provider === "groq") {
    // 401 = the key itself is wrong/revoked/incomplete (auth failure).
    if (status === 401 || code === "invalid_api_key") {
      return fail(
        'Groq rejected the API key (401): invalid, revoked, or incompletely copied. Copy the full key again from console.groq.com/keys — it starts with "gsk_".'
      );
    }
    // 403 = Groq's edge refused the request before (or at) auth. Real causes,
    // in observed order: wrong/revoked key, restricted or suspended account,
    // or the server's egress IP blocked at Cloudflare (common on VPS/cloud).
    // refineGroqError disambiguates these with a keyless probe.
    if (status === 403) {
      return fail(
        'Groq refused the request (403): the key is wrong or revoked, the account/org is restricted, or Groq\'s edge is blocking this server\'s network. Re-copy the key from console.groq.com/keys first; if the key is confirmed valid, the server\'s network is the problem.'
      );
    }
    // Model problems must not be confused with auth problems.
    if (code === "model_decommissioned" || code === "model_not_found" || status === 410) {
      return fail(
        `Groq does not serve this model${detail ? `: ${detail}` : ""} — pick another model ("Fetch models" shows the live list).`
      );
    }
  }

  if (status === 401 || status === 403) {
    return fail("Authentication failed (401/403) — check the API key.");
  }
  if (status === 404) {
    return fail(
      provider === "ollama"
        ? "Endpoint not found (404) — the base URL is wrong, or this Ollama build predates the OpenAI-compatible API (upgrade Ollama ≥ 0.1.24)."
        : `Endpoint not found (404) — check the model id or base URL. ${detail}`
    );
  }
  if (status === 429) {
    return fail("Rate limit reached (429) — the free tier is busy; retry shortly or switch model.");
  }
  if (status >= 500) {
    return fail(`Provider server error (${status}) — retry shortly. ${detail}`);
  }
  return fail(`Provider returned HTTP ${status}. ${detail}`);
}

/**
 * Groq 403 is inherently ambiguous: the same status covers "bad/revoked key"
 * AND "Groq's edge (Cloudflare) blocks this server's network before auth".
 * A KEYLESS probe (GET /models, no Authorization header) disambiguates
 * definitively, because on a healthy network a missing key always yields 401:
 *   - probe 403        → the network is blocked; the key was NEVER evaluated
 *                        (re-copying it cannot help)
 *   - probe 401/other  → the request path reaches Groq's auth → the 403 is
 *                        about the key or the account/org
 *   - probe no route   → the server cannot reach api.groq.com at all
 * The probe never sends the key and never logs anything.
 */
export async function refineGroqError(cfg: ProviderConfig, err: unknown): Promise<Error> {
  if (!(err instanceof ProviderError) || err.status !== 403) return err as Error;
  let probeStatus = 0;
  let reached = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${cfg.baseUrl}/models`, { signal: controller.signal });
      probeStatus = res.status;
      await res.text().catch(() => "");
      reached = true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    reached = false;
  }

  if (!reached) {
    return new ProviderError(
      `Diagnosed: this server cannot reach api.groq.com at all (no route — DNS or firewall). Check the server's network, or use the built-in model / local Ollama instead.`
    );
  }
  if (probeStatus === 403) {
    return new ProviderError(
      "Diagnosed: Groq's edge network (Cloudflare) is blocking THIS SERVER's network — even a request WITHOUT a key gets 403, so your key was never evaluated and re-copying it will not help. Options: run Azm from a network Groq serves (e.g. the desktop app on a home/office network in a supported region), point the Base URL field to an OpenAI-compatible Groq relay you control, or use the built-in model / local Ollama here."
    );
  }
  return new ProviderError(
    "Diagnosed: the network path to Groq is healthy (a keyless probe reached Groq's authentication), so this 403 is about the KEY or ACCOUNT: revoked, incompletely copied, or the account/organization is restricted. Re-copy the full key from console.groq.com/keys and check your account status there."
  );
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  provider: ProviderId
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw describeHttpError(res.status, text, provider);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ProviderError("AI service returned a non-JSON response");
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError(`AI request timed out after ${timeoutMs} ms`);
    if (isNetworkError(e)) throw new ProviderError(networkHint(provider, url));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  provider: ProviderId
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { ...headers },
    });
    const text = await res.text();
    if (!res.ok) throw describeHttpError(res.status, text, provider);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ProviderError("AI service returned a non-JSON response");
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError(`request timed out after ${timeoutMs} ms`);
    if (isNetworkError(e)) throw new ProviderError(networkHint(provider, url));
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkError(e: unknown): boolean {
  const err = e as Error;
  return (
    err.name === "TypeError" ||
    /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|ECONNRESET|EAI_AGAIN|unable to connect/i.test(
      err.message ?? ""
    )
  );
}

function networkHint(provider: ProviderId, url: string): string {
  if (provider === "ollama") {
    return `Could not reach Ollama at ${url}. Checklist: (1) Ollama is running — start it with "ollama serve"; (2) the host is reachable from the Azm SERVER — use http://127.0.0.1:11434/v1 when Ollama runs on the same machine as Azm, or the other machine's LAN URL otherwise; (3) no firewall blocks the port.`;
  }
  return `Could not reach the provider at ${url} — check the network or the base URL.`;
}

function openAiHeaders(cfg: ProviderConfig): Record<string, string> {
  // Ollama needs no auth header; sending an empty Bearer breaks some builds.
  return cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
}

/** One JSON chat entry point. Returns parsed JSON or null (caller falls back). */
export async function chatJson(
  cfg: ProviderConfig | null,
  system: string,
  user: string,
  opts?: ChatOptions
): Promise<Record<string, unknown> | null> {
  const timeoutMs = opts?.timeoutMs ?? 25_000;
  const maxTokens = opts?.maxTokens ?? 500;
  const temperature = opts?.temperature ?? 0.2;
  try {
    if (!cfg) return null;

    if (cfg.kind === "builtin") {
      const zai = await ZAI.create();
      const completion = (await Promise.race([
        zai.chat.completions.create({
          messages: [
            { role: "assistant", content: system },
            { role: "user", content: user },
          ],
          thinking: { type: "disabled" },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("llm-timeout")), timeoutMs)),
      ])) as { choices?: { message?: { content?: string } }[] };
      return extractJson(completion.choices?.[0]?.message?.content ?? "");
    }

    if (cfg.kind === "anthropic") {
      const data = await postJson(
        `${cfg.baseUrl}/v1/messages`,
        { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: cfg.model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        },
        timeoutMs,
        cfg.kind
      );
      const blocks = (data.content ?? []) as Array<Record<string, unknown>>;
      const text = blocks.map((b) => (b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
      return extractJson(text);
    }

    // OpenAI-compatible: openai | groq | ollama
    const data = await postJson(
      `${cfg.baseUrl}/chat/completions`,
      openAiHeaders(cfg),
      {
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      timeoutMs,
      cfg.kind
    );
    const choices = (data.choices ?? []) as Array<{ message?: { content?: string } }>;
    return extractJson(choices[0]?.message?.content ?? "");
  } catch {
    // Decision paths intentionally swallow provider errors and fall back.
    return null;
  }
}

/* ------------------------------ streaming --------------------------------- */

export interface StreamChunk {
  delta: string;
}

export function providerSupportsStreaming(cfg: ProviderConfig | null): boolean {
  return Boolean(cfg && isOpenAiCompatible(cfg.kind));
}

/**
 * Stream a plain-text reply. Yields text deltas as they arrive.
 * OpenAI-compatible providers stream via SSE; builtin/anthropic fall back to
 * one buffered chunk (honest behavior, no fake typing simulation).
 */
export async function* streamChat(
  cfg: ProviderConfig | null,
  system: string,
  user: string,
  opts?: ChatOptions
): AsyncGenerator<StreamChunk, void, unknown> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const maxTokens = opts?.maxTokens ?? 400;
  const temperature = opts?.temperature ?? 0.4;

  if (!cfg) {
    throw new ProviderError("no provider configured");
  }

  if (!providerSupportsStreaming(cfg)) {
    // buffered fallback: one chunk for builtin / anthropic
    let text = "";
    if (cfg.kind === "builtin") {
      const zai = await ZAI.create();
      const completion = (await Promise.race([
        zai.chat.completions.create({
          messages: [
            { role: "assistant", content: system },
            { role: "user", content: user },
          ],
          thinking: { type: "disabled" },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("llm-timeout")), timeoutMs)),
      ])) as { choices?: { message?: { content?: string } }[] };
      text = completion.choices?.[0]?.message?.content ?? "";
    } else {
      const data = await postJson(
        `${cfg.baseUrl}/v1/messages`,
        { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
        {
          model: cfg.model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        },
        timeoutMs,
        cfg.kind
      );
      const blocks = (data.content ?? []) as Array<Record<string, unknown>>;
      text = blocks.map((b) => (b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
    }
    if (!text.trim()) throw new ProviderError("empty response");
    yield { delta: text };
    return;
  }

  // OpenAI-compatible SSE streaming
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...openAiHeaders(cfg) },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw describeHttpError(res.status, body, cfg.kind);
    }
    if (!res.body) throw new ProviderError("empty stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content ?? "";
          if (delta) yield { delta };
        } catch {
          /* ignore malformed keep-alive fragments */
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError(`stream timed out after ${timeoutMs} ms`);
    if (cfg.kind === "groq") throw await refineGroqError(cfg, e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ utilities --------------------------------- */

function extractJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Settings → "Test connection". Returns latency in ms; throws a readable error. */
export async function testProvider(cfg: ProviderConfig): Promise<number> {
  const t0 = Date.now();
  if (cfg.kind === "builtin") {
    try {
      const zai = await ZAI.create();
      const r = (await Promise.race([
        zai.chat.completions.create({
          messages: [
            { role: "assistant", content: "Reply with the single word OK." },
            { role: "user", content: "ping" },
          ],
          thinking: { type: "disabled" },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15_000)),
      ])) as { choices?: { message?: { content?: string } }[] };
      const text = r.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) throw new ProviderError("empty response");
      return Date.now() - t0;
    } catch (e) {
      throw builtinError(e);
    }
  }

  if (cfg.kind === "anthropic") {
    const data = await postJson(
      `${cfg.baseUrl}/v1/messages`,
      { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
      { model: cfg.model, max_tokens: 50, system: 'Reply with JSON {"ok":true} only.', messages: [{ role: "user", content: "ping" }] },
      15_000,
      cfg.kind
    );
    const blocks = (data.content ?? []) as Array<Record<string, unknown>>;
    const text = blocks.map((b) => (b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
    if (!extractJson(text)) throw new ProviderError("empty or invalid response");
    return Date.now() - t0;
  }

  // OpenAI-compatible: openai | groq | ollama — raw call so provider errors
  // (401 invalid key, 404 wrong endpoint, 429 rate limit) surface verbatim.
  let data: Record<string, unknown>;
  try {
    data = await postJson(
      `${cfg.baseUrl}/chat/completions`,
      openAiHeaders(cfg),
      {
        model: cfg.model,
        max_tokens: 50,
        temperature: 0,
        messages: [
          { role: "system", content: 'Reply with JSON {"ok":true} only.' },
          { role: "user", content: "ping" },
        ],
      },
      15_000,
      cfg.kind
    );
  } catch (e) {
    // Groq 403 is ambiguous (bad key vs edge network block) — refine it.
    if (cfg.kind === "groq") throw await refineGroqError(cfg, e);
    throw e;
  }
  const choices = (data.choices ?? []) as Array<{ message?: { content?: string } }>;
  const raw = choices[0]?.message?.content ?? "";
  // some local models may answer prose — accept any non-empty reply as alive
  if (!raw.trim()) throw new ProviderError("empty response from model");
  return Date.now() - t0;
}

export interface LiveModelsResult {
  models: Array<{ id: string; owned_by?: string }>;
}

/** Fetch the live model list from the provider (OpenAI-compatible /models). */
export async function listProviderModels(cfg: ProviderConfig, timeoutMs = 10_000): Promise<LiveModelsResult> {
  if (cfg.kind === "builtin") {
    return { models: [{ id: "zai", owned_by: "azm" }] };
  }
  if (cfg.kind === "anthropic") {
    const data = await getJson(
      `${cfg.baseUrl}/v1/models`,
      { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" },
      timeoutMs,
      cfg.kind
    );
    const rows = (data.data ?? []) as Array<{ id?: string }>;
    return { models: rows.filter((m) => typeof m.id === "string").map((m) => ({ id: m.id as string })) };
  }
  let data: Record<string, unknown>;
  try {
    data = await getJson(`${cfg.baseUrl}/models`, openAiHeaders(cfg), timeoutMs, cfg.kind);
  } catch (e) {
    if (cfg.kind === "groq") throw await refineGroqError(cfg, e);
    throw e;
  }
  const rows = (data.data ?? []) as Array<{ id?: string; owned_by?: string }>;
  return {
    models: rows
      .filter((m) => typeof m.id === "string")
      .map((m) => ({ id: m.id as string, owned_by: m.owned_by })),
  };
}
