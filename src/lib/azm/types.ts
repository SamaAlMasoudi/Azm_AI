/* Azm — shared domain types */

import type { InterventionLevel } from "./policy";

export type { InterventionLevel };

export type Lang = "ar" | "en";

export type Personality = "strict" | "friend" | "philosopher";

export type TechniqueId = "pomodoro" | "5217" | "custom";

export type OrbState = "idle" | "focused" | "working" | "alert" | "break";

export type SiteCategory =
  | "education"
  | "ai_tool"
  | "search"
  | "reference"
  | "social"
  | "entertainment"
  | "news"
  | "sports"
  | "unknown";

export type ScopeKind = "video" | "channel" | "playlist" | "domain" | "url";

export interface ScopeEntry {
  id: string;
  raw: string;
  pattern: string; // e.g. yt:video:XYZ | yt:channel:@h | yt:playlist:P | domain:coursera.org | url:host/path
  kind: ScopeKind;
  label: string;
}

export interface SessionConfig {
  goal: string;
  task: string;
  expectedOutcome: string;
  technique: TechniqueId;
  workMinutes: number;
  breakMinutes: number;
  personality: Personality;
  allowedSites: ScopeEntry[];
}

export interface SetupDraft extends SessionConfig {
  name: string;
}

export interface SessionGroupDTO {
  id: string;
  name: string;
  goal: string;
  task: string;
  expectedOutcome: string;
  technique: TechniqueId;
  workMinutes: number;
  breakMinutes: number;
  personality: Personality;
  allowedSites: ScopeEntry[];
  createdAt: string;
}

export interface ActiveSession extends SessionConfig {
  id: string;
  level: InterventionLevel;
  startedAt: number; // epoch ms
  focusedSeconds: number;
  breakSeconds: number;
  breakUsedSeconds: number; // smart-break budget consumed
  breakUntil: number | null; // agent break end (epoch ms)
  distractionAttempts: number;
  interventionsBlocked: number;
  interventionsApproved: number;
  interventionsUncertain: number;
  rounds: number;
  emergencyPassUsed: boolean;
}

export interface NavDestination {
  url: string; // canonical url, e.g. youtube.com/watch?v=abc
  siteId: string; // registry key of the mock site
  title: string;
  name: string; // site display name
  category: SiteCategory;
  videoId?: string;
  channel?: string;
  playlistId?: string;
  query?: string; // for search destinations
  path?: string;
}

export interface InterventionDTO {
  id: string;
  sessionId: string;
  siteName: string;
  siteUrl: string;
  category: string;
  explanation: string;
  verdict: "approved" | "rejected" | "timeout" | "self_corrected";
  classification: "supportive" | "uncertain" | "distracting" | "none";
  aiMessage: string;
  confidence: number | null;
  source: string;
  aiSource: string;
  createdAt: string;
}

export interface AiEvaluation {
  verdict: "approved" | "rejected";
  classification: "supportive" | "uncertain" | "distracting";
  confidence: number;
  message: string;
  source: "ai" | "heuristic";
}

/* ---------------- Agent (intent-based accountability) ---------------- */

export type ChallengeStatus = "asking" | "thinking" | "granted" | "denied" | "left" | "timeout";

export interface ChatLine {
  role: "azm" | "user";
  text: string;
}

export interface ChallengeDTO {
  id: string;
  kind: "site" | "break";
  domain: string;
  title: string;
  url: string;
  category: string;
  classification: "relevant" | "unrelated" | "uncertain";
  reason: string;
  status: ChallengeStatus;
  round: number;
  maxRounds: number;
  timerSec: number;
  extensions?: number;
  deadline: number | null;
  lines: ChatLine[];
}

export interface NavigateResult {
  sessionActive: boolean;
  onBreak: boolean;
  decision: "allow" | "challenge";
  classification?: {
    category: "relevant" | "unrelated" | "uncertain";
    confidence: number;
    reasonAr: string;
    reasonEn: string;
  };
  challenge?: ChallengeDTO;
}

export interface JustifyResult {
  status: "granted" | "denied" | "asking" | "timeout";
  message: string;
  minutes?: number;
  round?: number;
  maxRounds?: number;
  deadline?: number | null;
  classification?: "supportive" | "uncertain" | "distracting";
  source: "ai" | "heuristic";
  grant?: { domain: string; minutes: number; expiresAt: number };
  memorySaved?: boolean;
}

export interface BreakResult {
  status: "granted" | "denied" | "asking";
  message: string;
  minutes?: number;
  round?: number;
  maxRounds?: number;
  source: "ai" | "heuristic";
}

export interface GrantDTO {
  id: string;
  domain: string;
  minutes: number;
  reason: string;
  source: string;
  grantedAt: string;
  expiresAt: number;
}

export interface MemoryDTO {
  id: string;
  text: string;
  source: "user" | "agent";
  createdAt: string;
}

export type AiProviderId = "builtin" | "openai" | "anthropic" | "groq" | "ollama" | "off";

export interface AiStatusDTO {
  provider: AiProviderId;
  model: string;
  baseUrl: string;
  hasKey: boolean;
  keyPreview: string;
  /** per-provider key presence (raw keys never leave the server) */
  keys?: Record<string, { hasKey: boolean; keyPreview: string }>;
  /** configurable human-intervention window (10–120s, default 30) */
  challengeSeconds?: number;
}

export interface ProfileDTO {
  code: string;
  name: string;
  lang: Lang;
  interventionLevel: InterventionLevel;
  ai: AiStatusDTO;
  pairingToken: string;
  memoryCount: number;
  hasActiveSession: boolean;
  createdAt: string;
  extConnected?: boolean;
  extLastSeen?: number | null;
}

export interface ChatReply {
  reply: string;
  source: "ai" | "heuristic";
  memorySaved?: boolean;
}

export interface SessionReportData {
  level: InterventionLevel;
  plannedMinutes: number;
  breakBudgetMin: number;
  breakUsedMin: number;
  resources: string[];
  classificationCounts: { supportive: number; uncertain: number; distracting: number; selfCorrected: number };
  interventions: {
    id: string;
    at: string;
    site: string;
    url: string;
    category: string;
    verdict: string;
    classification: string;
    explanation: string;
    aiMessage: string;
    source: string;
    aiSource: string;
  }[];
  grants: { domain: string; minutes: number; reason: string; grantedAt: string; expiresAt: string }[];
  memoryAdded: { text: string; source: string; at: string }[];
  accomplishments: string;
}

export interface AiBreakDecision {
  granted: boolean;
  minutes: number;
  message: string;
  source: "ai" | "heuristic";
}

export interface AiEndDecision {
  action: "continue" | "allow_end" | "offer_break" | "use_pass";
  message: string;
  source: "ai" | "heuristic";
}

export interface AiVerification {
  verdict: "achieved" | "partial" | "not_achieved";
  message: string;
  source: "ai" | "heuristic";
}

export interface SessionSummaryData {
  sessionId: string;
  config: SessionConfig;
  startedAt: number;
  endedAt: number;
  focusedSeconds: number;
  breakSeconds: number;
  breakUsedSeconds: number;
  distractionAttempts: number;
  interventionsBlocked: number;
  interventionsApproved: number;
  interventionsUncertain: number;
  rounds: number;
  emergencyPassUsed: boolean;
  treeStage: number;
  verification: AiVerification | null;
  report: SessionReportData | null;
}

export interface AnalyticsSummary {
  week: {
    weekKey: string;
    sessions: number;
    focusedHours: number;
    savedHours: number;
    attempts: number;
    blocked: number;
    approved: number;
    uncertain: number;
    selfCorrected: number;
  };
  total: {
    sessions: number;
    focusedHours: number;
    attempts: number;
    blocked: number;
    approved: number;
    uncertain: number;
  };
  daily: { date: string; focusedMinutes: number }[];
  recent: InterventionDTO[];
  passUsedThisWeek: boolean;
}

export const TECHNIQUE_PRESETS: Record<
  Exclude<TechniqueId, "custom">,
  { work: number; break: number }
> = {
  pomodoro: { work: 25, break: 5 },
  "5217": { work: 52, break: 17 },
};

export function treeStageFor(focusedSeconds: number): number {
  const minutes = focusedSeconds / 60;
  if (minutes >= 105) return 5;
  if (minutes >= 70) return 4;
  if (minutes >= 40) return 3;
  if (minutes >= 20) return 2;
  if (minutes >= 8) return 1;
  return 0;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
