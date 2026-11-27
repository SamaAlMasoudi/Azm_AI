/* Azm — client API helpers (relative paths, profile-scoped) */

import type {
  ActiveSession,
  AiEndDecision,
  AiVerification,
  AnalyticsSummary,
  BreakResult,
  ChallengeDTO,
  ChatReply,
  GrantDTO,
  JustifyResult,
  MemoryDTO,
  NavDestination,
  NavigateResult,
  ProfileDTO,
  SessionConfig,
  SessionGroupDTO,
  SessionSummaryData,
} from "./types";
import { readProfileCode } from "./profile-client";

/** A failed API call: carries the HTTP status and the server's own message. */
export class ApiError extends Error {
  status: number;
  serverMessage: string;
  constructor(url: string, status: number, serverMessage: string) {
    super(`API ${url} failed: ${status}${serverMessage ? ` — ${serverMessage}` : ""}`);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** Read the server's `error` field from a failed response (JSON or plain text). */
async function failure(url: string, res: Response): Promise<ApiError> {
  let msg = "";
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: unknown };
      msg = typeof j?.error === "string" ? j.error : "";
    } catch {
      msg = ""; // HTML error page etc. — not useful to show
    }
  } catch {
    /* body unreadable */
  }
  return new ApiError(url, res.status, msg);
}

/**
 * One sentence that says WHY a call failed, instead of a blanket
 * "network error": unreachable server vs. missing route vs. server fault.
 */
export function describeApiFailure(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.serverMessage) return e.serverMessage;
    if (e.status === 404) return "The Azm server has no such endpoint (404) — the deployed backend is missing or out of date.";
    if (e.status === 401 || e.status === 403) return `The Azm server refused the request (${e.status}).`;
    if (e.status === 429) return "Too many requests (429) — wait a moment and try again.";
    if (e.status >= 500) return `The Azm server failed to handle the request (HTTP ${e.status}) — check the server log or /api/health.`;
    return `The Azm server answered with HTTP ${e.status}.`;
  }
  return "Cannot reach the Azm server — check your internet connection and that the app is running.";
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-azm-profile": readProfileCode() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await failure(url, res);
  return res.json();
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "x-azm-profile": readProfileCode() } });
  if (!res.ok) throw await failure(url, res);
  return res.json();
}

async function del<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", headers: { "x-azm-profile": readProfileCode() } });
  if (!res.ok) throw await failure(url, res);
  return res.json();
}

/* ---------- Profile ---------- */

export function apiGetProfile(): Promise<{ profile: ProfileDTO }> {
  return get("/api/profile");
}

export async function apiUpdateProfile(body: Record<string, unknown>): Promise<{ profile: ProfileDTO }> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-azm-profile": readProfileCode() },
    body: JSON.stringify(body),
  });
  // a failed update must not be mistaken for a profile (it used to wipe the store's profile)
  if (!res.ok) throw await failure("/api/profile", res);
  return res.json();
}

export function apiRegeneratePairing(): Promise<{ pairingToken: string }> {
  return post("/api/profile/pairing");
}

/* ---------- Agent ---------- */

export function apiNavigate(body: {
  url: string;
  title: string;
  category?: string;
  source: "link" | "address_bar" | "search";
  lang: string;
}): Promise<NavigateResult> {
  return post("/api/agent/navigate", body);
}

export function apiJustify(challengeId: string, text: string): Promise<JustifyResult> {
  return post("/api/agent/justify", { challengeId, text });
}

export function apiAgentTimeout(challengeId: string, lang: string): Promise<JustifyResult> {
  return post("/api/agent/timeout", { challengeId, lang });
}

export function apiExtendChallenge(challengeId: string, seconds?: number): Promise<{ ok: boolean; deadline: number | null; extensions: number; reason?: string }> {
  return post("/api/agent/extend", { challengeId, seconds });
}

export interface LiveModelsResult {
  provider: string;
  live: boolean;
  error?: string;
  models: Array<{ id: string; tier?: string }>;
}

export function apiListModels(provider: string): Promise<LiveModelsResult> {
  return get(`/api/ai/models?provider=${encodeURIComponent(provider)}`);
}

export function apiTestProviderForm(body: { aiProvider: string; aiModel?: string; aiBaseUrl?: string; aiApiKey?: string }): Promise<{ ok: boolean; ms?: number; error?: string; provider?: string; model?: string; off?: boolean }> {
  return post("/api/ai/test", body);
}

/** Streaming chat (SSE). Calls onDelta per chunk; resolves with the final event. */
export async function apiChatStream(
  lines: Array<{ role: "azm" | "user"; text: string }>,
  personality: string,
  onDelta: (delta: string) => void
): Promise<ChatReply> {
  const res = await fetch("/api/ai/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-azm-profile": readProfileCode() },
    body: JSON.stringify({ lines, personality }),
  });
  if (!res.ok || !res.body) throw new Error("stream unavailable");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ChatReply = { reply: "", source: "heuristic" };
  let streamError = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const evt = JSON.parse(line.slice(5).trim()) as {
          delta?: string;
          done?: boolean;
          reply?: string;
          source?: "ai" | "heuristic";
          memorySaved?: boolean;
          error?: string;
        };
        if (evt.delta) onDelta(evt.delta);
        if (evt.error) streamError = evt.error;
        if (evt.done && !evt.error) {
          final = {
            reply: evt.reply || "",
            source: evt.source ?? "heuristic",
            memorySaved: evt.memorySaved,
          };
        }
      } catch {
        /* ignore malformed fragments */
      }
    }
  }
  // stream-level failure → let the caller fall back to the buffered endpoint
  if (streamError && !final.reply) throw new Error(streamError);
  return final;
}

export function apiGetChallenge(id: string): Promise<{ challenge: ChallengeDTO | null }> {
  return get(`/api/agent/navigate?id=${encodeURIComponent(id)}`);
}

export function apiGrants(): Promise<{ grants: GrantDTO[] }> {
  return get("/api/grants");
}

export function apiMemory(): Promise<{ memory: MemoryDTO[] }> {
  return get("/api/memory");
}

export function apiAddMemory(text: string): Promise<{ ok: boolean }> {
  return post("/api/memory", { text });
}

export function apiDeleteMemory(id: string): Promise<{ ok: boolean }> {
  return del(`/api/memory?id=${encodeURIComponent(id)}`);
}

/* ---------- AI ---------- */

export function apiChat(lines: Array<{ role: "azm" | "user"; text: string }>, personality: string): Promise<ChatReply> {
  return post("/api/ai/chat", { lines, personality });
}

export function apiTestProvider(): Promise<{ ok: boolean; ms?: number; error?: string }> {
  return post("/api/ai/test");
}

export function apiBreakRequest(body: {
  lang: string;
  personality: string;
  session: Record<string, unknown>;
  request: string;
}): Promise<BreakResult> {
  return post("/api/ai/break", body);
}

export function apiEndDialogue(body: {
  lang: string;
  personality: string;
  session: Record<string, unknown>;
  reason: string;
  hasPass: boolean;
}): Promise<AiEndDecision> {
  return post("/api/ai/end", body);
}

export function apiVerify(body: {
  lang: string;
  personality: string;
  expectedOutcome: string;
  accomplishments: string;
  focusedMinutes: number;
  plannedMinutes: number;
  blockedAttempts: number;
}): Promise<AiVerification> {
  return post("/api/ai/verify", body);
}

/* ---------- Sessions ---------- */

export function apiCreateSession(config: SessionConfig): Promise<{ id: string; startedAt: string; level: string }> {
  return post("/api/sessions", config);
}

export function apiGetActiveSession(): Promise<{ session: ActiveSession | null }> {
  return get("/api/sessions/active");
}

export interface SessionSnapshot {
  focusedSeconds: number;
  breakSeconds: number;
  breakUsedSeconds?: number;
  breakUntil?: number | null;
  distractionAttempts: number;
  interventionsBlocked: number;
  interventionsApproved: number;
  interventionsUncertain: number;
  rounds: number;
  treeStage: number;
}

export function apiSyncSession(id: string, snap: SessionSnapshot): Promise<{ ok: boolean }> {
  return post(`/api/sessions/${id}/sync`, snap);
}

export function apiEndSession(
  id: string,
  data: {
    snapshot: SessionSnapshot;
    emergencyPassUsed: boolean;
    accomplishments?: string;
    verification?: AiVerification;
  }
): Promise<{ ok: boolean; report?: SessionSummaryData["report"] }> {
  return post(`/api/sessions/${id}/end`, data);
}

export function apiRecordIntervention(data: {
  sessionId: string;
  siteName: string;
  siteUrl: string;
  category: string;
  explanation: string;
  verdict: string;
  classification: string;
  aiMessage: string;
  confidence?: number;
  source: string;
  aiSource: string;
}): Promise<{ ok: boolean }> {
  return post("/api/interventions", data);
}

/* ---------- Groups ---------- */

export function apiListGroups(): Promise<{ groups: SessionGroupDTO[] }> {
  return get("/api/groups");
}

export function apiSaveGroup(body: SessionGroupDTO): Promise<{ group: SessionGroupDTO }> {
  return post("/api/groups", body);
}

export function apiDeleteGroup(id: string): Promise<{ ok: boolean }> {
  return del(`/api/groups/${id}`);
}

/* ---------- Passes / analytics / misc ---------- */

export function apiPassStatus(): Promise<{ used: boolean }> {
  return get("/api/passes");
}

export function apiUsePass(sessionId: string): Promise<{ ok: boolean }> {
  return post("/api/passes", { sessionId });
}

export function apiAnalytics(): Promise<AnalyticsSummary> {
  return get("/api/analytics/summary");
}

export function apiSeedDemo(): Promise<{ ok: boolean }> {
  return post("/api/seed");
}

export function apiResetAll(): Promise<{ ok: boolean }> {
  return post("/api/reset");
}

/** Destination title/category helper shared by callers of apiNavigate. */
export function navPayload(dest: Pick<NavDestination, "url" | "title" | "category">, source: "link" | "address_bar" | "search", lang: string) {
  return { url: dest.url, title: dest.title, category: dest.category, source, lang };
}
