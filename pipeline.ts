/* Azm — server agent pipeline shared by the web app and the Chrome extension:
 *
 *   navigation → intent classification → intervention policy → CHALLENGE
 *     → student justifies (multi-round conversation) → agent decision
 *        allow_site (temporary grant) | grant_break | deny | ask_followup
 *        + remember (AI Memory)
 *
 * Hard guard-rails live in agent.ts. The model proposes; the code disposes.
 */

import { db } from "@/lib/db";
import type { Profile, StudySession } from "@prisma/client";
import { classifyIntent, type Classification } from "./classifier";
import {
  challengeOpener,
  TIMEOUT_MESSAGES,
  judgeWithLlm,
  heuristicJudge,
  enforceDecision,
  type ChatLine,
  type JudgeInput,
} from "./agent";
import { resolveProvider } from "./llm";
import { toPersonalityId } from "./ai";
import { cleanText } from "./profile";
import { decidePolicy, LEVELS, normalizeLevel, type IntentCategory, type InterventionLevel } from "../policy";
import type { Lang } from "../types";

/* --------------------------------- types ---------------------------------- */

export type ChallengeStatus = "asking" | "thinking" | "granted" | "denied" | "left" | "timeout";

export interface ChallengeDTO {
  id: string;
  kind: "site" | "break";
  domain: string;
  title: string;
  url: string;
  category: string;
  classification: IntentCategory;
  reason: string;
  status: ChallengeStatus;
  round: number;
  maxRounds: number;
  timerSec: number;
  extensions: number;
  deadline: number | null;
  lines: ChatLine[];
}

export interface NavigateResult {
  sessionActive: boolean;
  onBreak: boolean;
  decision: "allow" | "challenge";
  classification?: Classification;
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

/* ------------------------- intervention timeout ---------------------------- */

/** The student's configurable human-intervention window (10–120s, default 30). */
export function effectiveChallengeSeconds(profile: Pick<Profile, "challengeSeconds">): number {
  const v = Math.round(profile.challengeSeconds);
  if (!Number.isFinite(v)) return 30;
  return Math.max(10, Math.min(120, v));
}

export const CHALLENGE_EXTENSION_SEC = 30;
export const CHALLENGE_MAX_EXTENSIONS = 3;

export async function extendChallenge(args: {
  profileId: string;
  challengeId: string;
  seconds: number;
}): Promise<{ ok: boolean; deadline: number | null; extensions: number; reason?: string }> {
  const challenge = await db.challenge.findFirst({
    where: { id: args.challengeId, profileId: args.profileId },
  });
  if (!challenge || challenge.status !== "asking") {
    return { ok: false, deadline: null, extensions: 0, reason: "not-asking" };
  }
  if (challenge.extensions >= CHALLENGE_MAX_EXTENSIONS) {
    return { ok: false, deadline: challenge.deadline?.getTime() ?? null, extensions: challenge.extensions, reason: "max-extensions" };
  }
  const seconds = Math.max(10, Math.min(60, Math.round(args.seconds) || CHALLENGE_EXTENSION_SEC));
  const base = challenge.deadline && challenge.deadline.getTime() > Date.now() ? challenge.deadline.getTime() : Date.now();
  const deadline = new Date(base + seconds * 1000);
  const extensions = challenge.extensions + 1;
  await db.challenge.update({
    where: { id: challenge.id },
    data: { deadline, extensions, timerSec: Math.round((deadline.getTime() - Date.now()) / 1000) },
  });
  return { ok: true, deadline: deadline.getTime(), extensions };
}

function bare(domain: string): string {
  return domain.replace(/^www\./, "").toLowerCase();
}

function sameSite(a: string, b: string): boolean {
  const x = bare(a);
  const y = bare(b);
  return x === y || x.endsWith("." + y) || y.endsWith("." + x);
}

/** Server-side scope matching (declared resources) for any URL. */
export function matchesDeclaredScope(session: Pick<StudySession, "allowedSites">, rawUrl: string): boolean {
  let allowedSites: Array<{ pattern: string; kind: string }> = [];
  try {
    allowedSites = JSON.parse(session.allowedSites);
  } catch {
    return false;
  }
  let url = rawUrl.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (!url.includes("://") && !url.startsWith("http")) {
    // already stripped protocol above
  }
  url = url.replace(/^https?:\/\//, "");
  const host = url.split("/")[0] ?? "";
  const [pathPart, queryPart] = url.split("?");
  const q = new URLSearchParams(queryPart ?? "");
  const videoId = q.get("v") ?? undefined;
  const playlistId = q.get("list") ?? undefined;
  const channelMatch = (pathPart ?? "").match(/^\/(@[\w\u0600-\u06FF.-]+)/);

  for (const entry of allowedSites) {
    const p = entry.pattern ?? "";
    if (p.startsWith("yt:video:") && videoId && videoId === p.slice("yt:video:".length)) return true;
    if (p.startsWith("yt:playlist:") && playlistId && playlistId === p.slice("yt:playlist:".length)) return true;
    if (p.startsWith("yt:channel:") && channelMatch && channelMatch[1]!.toLowerCase() === p.slice("yt:channel:".length).toLowerCase()) return true;
    if (p.startsWith("yt:") && (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be")) {
      // generic youtube entry (domain:youtube.com parsed from a YT url)
    }
    if (p.startsWith("domain:")) {
      const d = p.slice("domain:".length);
      if (host === d || host.endsWith("." + d)) return true;
    }
    if (p.startsWith("url:")) {
      const target = p.slice("url:".length);
      if (url.startsWith(target)) return true;
    }
  }
  return false;
}

function parseLines(raw: string): ChatLine[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ChatLine[]) : [];
  } catch {
    return [];
  }
}

export function toChallengeDTO(c: {
  id: string;
  kind: string;
  domain: string;
  title: string;
  url: string;
  category: string;
  classification: string;
  reason: string;
  status: string;
  round: number;
  maxRounds: number;
  timerSec: number;
  extensions?: number;
  deadline: Date | null;
  linesJson: string;
}): ChallengeDTO {
  return {
    id: c.id,
    kind: c.kind === "break" ? "break" : "site",
    domain: c.domain,
    title: c.title,
    url: c.url,
    category: c.category,
    classification: (["relevant", "unrelated", "uncertain"].includes(c.classification) ? c.classification : "uncertain") as IntentCategory,
    reason: c.reason,
    status: (["asking", "thinking", "granted", "denied", "left", "timeout"].includes(c.status) ? c.status : "asking") as ChallengeStatus,
    round: c.round,
    maxRounds: c.maxRounds,
    timerSec: c.timerSec,
    extensions: c.extensions ?? 0,
    deadline: c.deadline ? c.deadline.getTime() : null,
    lines: parseLines(c.linesJson),
  };
}

export async function memoryTexts(profileId: string, limit = 12): Promise<string[]> {
  const rows = await db.memoryItem.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { text: true },
  });
  return rows.map((r) => r.text);
}

export async function addMemory(profileId: string, text: string, source: "user" | "agent"): Promise<boolean> {
  const t = cleanText(text, 200);
  if (!t) return false;
  const existing = await db.memoryItem.findFirst({ where: { profileId, text: t } });
  if (existing) return false;
  await db.memoryItem.create({ data: { profileId, text: t, source } });
  return true;
}

async function recordIntervention(args: {
  profileId: string;
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
}): Promise<void> {
  await db.intervention.create({
    data: {
      profileId: args.profileId,
      sessionId: args.sessionId,
      siteName: args.siteName.slice(0, 120),
      siteUrl: args.siteUrl.slice(0, 500),
      category: args.category,
      explanation: args.explanation.slice(0, 500),
      verdict: args.verdict,
      classification: args.classification,
      aiMessage: args.aiMessage.slice(0, 500),
      confidence: args.confidence,
      source: args.source,
      aiSource: args.aiSource,
    },
  });
}

export function levelOf(session: StudySession): { levelId: InterventionLevel; lv: (typeof LEVELS)[InterventionLevel] } {
  const levelId = normalizeLevel(session.level);
  return { levelId, lv: LEVELS[levelId] };
}

async function counterUpdate(
  sessionId: string,
  patch: Partial<Record<"distractionAttempts" | "interventionsBlocked" | "interventionsApproved" | "interventionsUncertain", number | { increment: number }>> & { uncertainStreak?: number }
): Promise<void> {
  await db.studySession.update({ where: { id: sessionId }, data: patch as never });
}

/* ------------------------------- navigate --------------------------------- */

export async function navigate(args: {
  profile: Profile;
  url: string;
  domain: string;
  title: string;
  categoryHint?: string;
  source: "link" | "address_bar" | "search" | "extension";
  tabId?: number | null;
  lang: Lang;
  salt?: number;
}): Promise<NavigateResult> {
  const { profile } = args;
  const session = await db.studySession.findFirst({
    where: { profileId: profile.id, status: "active" },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return { sessionActive: false, onBreak: false, decision: "allow" };

  const domain = bare(args.domain);
  const onBreak = Boolean(session.breakUntil && session.breakUntil.getTime() > Date.now());

  // A break is authoritative: never reopen or return an interception while it is active.
  if (onBreak) return { sessionActive: true, onBreak: true, decision: "allow" };

  // A grant already covers this domain -> free to browse.
  const grants = await db.grant.findMany({ where: { profileId: profile.id, expiresAt: { gt: new Date() } } });
  if (grants.some((g) => sameSite(g.domain, domain))) {
    return { sessionActive: true, onBreak, decision: "allow" };
  }

  // Open challenges: dedupe same site, cancel stale ones (student moved on).
  const open = await db.challenge.findMany({
    where: { profileId: profile.id, status: { in: ["asking", "thinking"] }, kind: "site" },
  });
  const sameOpen = open.find((c) => sameSite(c.domain, domain) && (args.tabId == null || c.tabId == null || c.tabId === args.tabId));
  if (sameOpen) {
    return { sessionActive: true, onBreak, decision: "challenge", challenge: toChallengeDTO(sameOpen) };
  }
  for (const c of open) {
    await db.challenge.update({ where: { id: c.id }, data: { status: "left" } });
  }

  // 1) classify intent (deterministic, <1ms)
  const classification = classifyIntent({
    url: args.url,
    domain,
    title: args.title,
    catalogCategory: args.categoryHint,
    inDeclaredScope: matchesDeclaredScope(session, args.url),
    session: {
      goal: session.goal,
      task: session.task,
      expectedOutcome: session.expectedOutcome,
      allowedSites: safeScope(session.allowedSites),
      memory: await memoryTexts(profile.id, 8),
    },
  });

  // 2) policy: does this level challenge it?
  const { levelId, lv } = levelOf(session);
  const streak = session.uncertainStreak ?? 0;
  const nextStreak = classification.category === "uncertain" ? streak + 1 : 0;
  const decision = decidePolicy({
    level: levelId,
    category: classification.category,
    hasGrant: false,
    uncertainStreak: classification.category === "uncertain" ? nextStreak : 0,
    challengeOpen: false,
  });

  if (decision.action !== "challenge") {
    await db.studySession.update({
      where: { id: session.id },
      data: { uncertainStreak: classification.category === "uncertain" ? nextStreak : 0 },
    });
    return { sessionActive: true, onBreak, decision: "allow", classification };
  }

  // 3) open a challenge with the persona opener
  const gentle = classification.category === "uncertain";
  const salt = args.salt ?? Math.floor(Math.random() * 4);
  // the student's configurable window overrides the level preset (10–120s)
  const windowSec = effectiveChallengeSeconds(profile);
  const opener = challengeOpener({
    lang: args.lang,
    personality: toPersonalityId(session.personality),
    gentle,
    timerSec: windowSec,
    salt,
  });
  const challenge = await db.challenge.create({
    data: {
      profileId: profile.id,
      sessionId: session.id,
      kind: "site",
      domain,
      title: args.title.slice(0, 300),
      url: args.url.slice(0, 500),
      category: args.categoryHint ?? "unknown",
      classification: classification.category,
      reason: args.lang === "ar" ? classification.reasonAr : classification.reasonEn,
      status: "asking",
      round: 1,
      maxRounds: lv.maxRounds,
      timerSec: windowSec,
      deadline: new Date(Date.now() + windowSec * 1000),
      linesJson: JSON.stringify([{ role: "azm", text: opener } satisfies ChatLine]),
      source: args.source === "extension" ? "extension" : "web",
      tabId: args.tabId ?? null,
      lang: args.lang,
    },
  });
  await counterUpdate(session.id, { distractionAttempts: { increment: 1 }, uncertainStreak: 0 });

  return { sessionActive: true, onBreak, decision: "challenge", classification, challenge: toChallengeDTO(challenge) };
}

/* -------------------------------- justify --------------------------------- */

export async function justify(args: {
  profile: Profile;
  challengeId: string;
  text: string;
}): Promise<JustifyResult> {
  const challenge = await db.challenge.findFirst({
    where: { id: args.challengeId, profileId: args.profile.id },
  });
  if (!challenge || !["asking"].includes(challenge.status)) {
    return { status: "denied", message: "", source: "heuristic" };
  }
  const session = challenge.sessionId
    ? await db.studySession.findUnique({ where: { id: challenge.sessionId } })
    : null;
  if (!session || session.status !== "active") {
    await db.challenge.update({ where: { id: challenge.id }, data: { status: "left" } });
    return { status: "denied", message: "", source: "heuristic" };
  }
  const text = cleanText(args.text, 300);
  if (!text) return { status: "denied", message: "", source: "heuristic" };

  // Grace rule: a justification is NEVER rejected merely because the original
  // countdown expired. The deadline only drives the automatic timeout for
  // *silent* students (the client calls the timeout endpoint); any answer that
  // actually arrives while the challenge is still open counts — and the client
  // auto-extends the window while the student is typing.

  const { lv } = levelOf(session);
  const lines = parseLines(challenge.linesJson);
  lines.push({ role: "user", text });
  await db.challenge.update({ where: { id: challenge.id }, data: { linesJson: JSON.stringify(lines), status: "thinking", deadline: null } });

  const workSec = session.workMinutes * 60;
  const focusedMin = Math.floor(session.focusedSeconds / 60);
  const remainingSec = Math.max(60, workSec - (session.focusedSeconds % workSec));
  const input: JudgeInput = {
    lang: challenge.lang as Lang,
    personality: toPersonalityId(session.personality),
    level: lv,
    session: {
      goal: session.goal,
      task: session.task,
      expectedOutcome: session.expectedOutcome,
      resources: safeScope(session.allowedSites).map((s) => s.pattern),
      focusedMin,
      remainingMin: Math.floor(remainingSec / 60),
    },
    memory: await memoryTexts(args.profile.id),
    kind: challenge.kind === "break" ? "break" : "site",
    site:
      challenge.kind === "site"
        ? {
            domain: challenge.domain,
            title: challenge.title,
            category: challenge.category,
            classification: challenge.classification,
            reason: challenge.reason,
            entertainment: ["entertainment", "social", "sports"].includes(challenge.category),
          }
        : null,
    lines,
    round: challenge.round,
    breakUsedMin: Math.round(session.breakUsedSeconds / 60),
  };

  // the agent judges (LLM when available, honest rules otherwise)
  const cfg = resolveProvider(args.profile);
  let d = cfg ? await judgeWithLlm(cfg, input) : null;
  if (!d) d = heuristicJudge(input);
  d = enforceDecision(input, d);

  const rememberSaved = d.remember ? await addMemory(args.profile.id, d.remember, "agent") : false;
  lines.push({ role: "azm", text: d.message });

  if (d.action === "allow_site" && challenge.kind === "site") {
    const expiresAt = new Date(Date.now() + d.minutes * 60_000);
    await db.grant.create({
      data: {
        profileId: args.profile.id,
        sessionId: session.id,
        domain: challenge.domain,
        minutes: d.minutes,
        reason: text.slice(0, 300),
        source: challenge.source === "extension" ? "extension" : "web",
        expiresAt,
      },
    });
    await db.challenge.update({
      where: { id: challenge.id },
      data: { status: "granted", linesJson: JSON.stringify(lines), deadline: null },
    });
    const classification = challenge.classification === "relevant" ? "supportive" : challenge.classification === "uncertain" ? "uncertain" : "supportive";
    await recordIntervention({
      profileId: args.profile.id,
      sessionId: session.id,
      siteName: challenge.title || challenge.domain,
      siteUrl: challenge.url,
      category: challenge.category,
      explanation: text,
      verdict: "approved",
      classification,
      aiMessage: d.message,
      confidence: 0.8,
      source: challenge.source === "extension" ? "extension" : "web",
      aiSource: d.source,
    });
    await counterUpdate(session.id, {
      interventionsApproved: { increment: classification === "supportive" ? 1 : 0 },
      interventionsUncertain: { increment: classification === "uncertain" ? 1 : 0 },
    });
    return {
      status: "granted",
      message: d.message,
      minutes: d.minutes,
      classification,
      source: d.source,
      grant: { domain: challenge.domain, minutes: d.minutes, expiresAt: expiresAt.getTime() },
      memorySaved: rememberSaved,
    };
  }

  if (d.action === "grant_break" && challenge.kind === "break") {
    await db.challenge.update({
      where: { id: challenge.id },
      data: { status: "granted", linesJson: JSON.stringify(lines), deadline: null },
    });
    await recordIntervention({
      profileId: args.profile.id,
      sessionId: session.id,
      siteName: "—",
      siteUrl: "",
      category: "break",
      explanation: text,
      verdict: "granted_break",
      classification: "none",
      aiMessage: d.message,
      source: "web",
      aiSource: d.source,
    });
    await db.studySession.update({
      where: { id: session.id },
      data: { breakUsedSeconds: { increment: d.minutes * 60 } },
    });
    return { status: "granted", message: d.message, minutes: d.minutes, source: d.source, memorySaved: rememberSaved };
  }

  if (d.action === "grant_break" && challenge.kind === "site") {
    // the model tried to grant a break inside a site challenge — refuse
    d = { ...d, action: "deny" };
  }

  if (d.action === "deny") {
    await db.challenge.update({
      where: { id: challenge.id },
      data: { status: "denied", linesJson: JSON.stringify(lines), deadline: null },
    });
    await recordIntervention({
      profileId: args.profile.id,
      sessionId: session.id,
      siteName: challenge.kind === "break" ? "—" : challenge.title || challenge.domain,
      siteUrl: challenge.url,
      category: challenge.kind === "break" ? "break" : challenge.category,
      explanation: text,
      verdict: "rejected",
      classification: challenge.kind === "break" ? "none" : "distracting",
      aiMessage: d.message,
      confidence: 0.75,
      source: challenge.source === "extension" ? "extension" : "web",
      aiSource: d.source,
    });
    if (challenge.kind === "site") {
      await counterUpdate(session.id, { interventionsBlocked: { increment: 1 } });
    }
    return { status: "denied", message: d.message, classification: "distracting", source: d.source, memorySaved: rememberSaved };
  }

  // ask_followup: one more round, countdown re-armed for site challenges
  const round = challenge.round + 1;
  const deadline = challenge.kind === "site" ? new Date(Date.now() + effectiveChallengeSeconds(args.profile) * 1000) : null;
  await db.challenge.update({
    where: { id: challenge.id },
    data: { status: "asking", round, linesJson: JSON.stringify(lines), deadline },
  });
  return {
    status: "asking",
    message: d.message,
    round,
    maxRounds: lv.maxRounds,
    deadline: deadline ? deadline.getTime() : null,
    source: d.source,
    memorySaved: rememberSaved,
  };
}

/* -------------------------------- timeout --------------------------------- */

export async function timeoutChallenge(profileId: string, challengeId: string, lang: Lang): Promise<JustifyResult> {
  const challenge = await db.challenge.findFirst({ where: { id: challengeId, profileId } });
  if (!challenge || challenge.status !== "asking") {
    return { status: "denied", message: "", source: "heuristic" };
  }
  const session = challenge.sessionId ? await db.studySession.findUnique({ where: { id: challenge.sessionId } }) : null;
  const msg = TIMEOUT_MESSAGES[toPersonalityId(session?.personality ?? "strict")][lang];
  const lines = parseLines(challenge.linesJson);
  lines.push({ role: "azm", text: msg });
  await db.challenge.update({
    where: { id: challenge.id },
    data: { status: "timeout", linesJson: JSON.stringify(lines), deadline: null },
  });
  if (session) {
    await recordIntervention({
      profileId,
      sessionId: session.id,
      siteName: challenge.title || challenge.domain,
      siteUrl: challenge.url,
      category: challenge.category,
      explanation: "",
      verdict: "timeout",
      classification: "distracting",
      aiMessage: msg,
      source: challenge.source === "extension" ? "extension" : "web",
      aiSource: "heuristic",
    });
    await counterUpdate(session.id, { interventionsBlocked: { increment: 1 } });
  }
  return { status: "timeout", message: msg, classification: "distracting", source: "heuristic" };
}

/* ------------------------------ break request ------------------------------ */

export async function requestBreak(args: { profile: Profile; text: string; lang: Lang }): Promise<JustifyResult> {
  const session = await db.studySession.findFirst({
    where: { profileId: args.profile.id, status: "active" },
    orderBy: { startedAt: "desc" },
  });
  if (!session) return { status: "denied", message: "", source: "heuristic" };
  const text = cleanText(args.text, 300);
  if (!text) return { status: "denied", message: "", source: "heuristic" };

  // reuse an open break challenge (multi-round conversation)
  let challenge = await db.challenge.findFirst({
    where: { profileId: args.profile.id, sessionId: session.id, kind: "break", status: "asking" },
  });
  if (challenge) {
    const lines = parseLines(challenge.linesJson);
    lines.push({ role: "user", text });
    await db.challenge.update({ where: { id: challenge.id }, data: { linesJson: JSON.stringify(lines), status: "thinking" } });
  } else {
    challenge = await db.challenge.create({
      data: {
        profileId: args.profile.id,
        sessionId: session.id,
        kind: "break",
        status: "asking",
        round: 1,
        maxRounds: levelOf(session).lv.maxRounds,
        linesJson: JSON.stringify([{ role: "user", text } satisfies ChatLine]),
        lang: args.lang,
      },
    });
  }
  return justify({ profile: args.profile, challengeId: challenge.id, text });
}

/* --------------------------------- utils ---------------------------------- */

function safeScope(raw: string): Array<{ pattern: string; kind: string }> {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
