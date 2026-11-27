/* Azm — intervention policy: the bridge between classification and action.
 *
 * The classifier only labels activity (relevant / unrelated / uncertain).
 * This layer decides whether Azm intervenes — and HOW hard — based on the
 * student's chosen intervention level. It is shared (client + server) so the
 * web app, the Chrome extension bridge and the future Electron shell all
 * behave identically.
 */

export type InterventionLevel = "passive" | "gentle" | "balanced" | "strict";

export type IntentCategory = "relevant" | "unrelated" | "uncertain";

export interface LevelProfile {
  /** categories that trigger a challenge */
  challengeOn: IntentCategory[];
  /** seconds the student has to answer each round (0 = never challenged) */
  timerSec: number;
  /** follow-up conversation rounds allowed per challenge */
  maxRounds: number;
  /** uncertain navigations tolerated before a challenge (1 = immediately) */
  uncertainTolerance: number;
  /** cap for temporary-access grants (minutes) */
  grantMaxMin: number;
  /** default temporary-access grant (minutes) */
  grantDefaultMin: number;
  /** total smart-break minutes per session */
  breakBudgetMin: number;
  /** focused minutes required before a smart break can be granted */
  minStudyBeforeBreakMin: number;
  /** max minutes of a single smart break */
  maxSingleBreakMin: number;
  /** encouragement nudges every N focused minutes (0 = off) */
  nudgeEveryMin: number;
  /** grants for clearly entertaining destinations are refused */
  denyEntertainmentGrants: boolean;
}

export const LEVELS: Record<InterventionLevel, LevelProfile> = {
  passive: {
    challengeOn: [],
    timerSec: 0,
    maxRounds: 1,
    uncertainTolerance: Number.POSITIVE_INFINITY,
    grantMaxMin: 15,
    grantDefaultMin: 10,
    breakBudgetMin: 20,
    minStudyBeforeBreakMin: 10,
    maxSingleBreakMin: 10,
    nudgeEveryMin: 15,
    denyEntertainmentGrants: false,
  },
  gentle: {
    challengeOn: ["unrelated"],
    timerSec: 20,
    maxRounds: 1,
    uncertainTolerance: Number.POSITIVE_INFINITY,
    grantMaxMin: 10,
    grantDefaultMin: 8,
    breakBudgetMin: 20,
    minStudyBeforeBreakMin: 8,
    maxSingleBreakMin: 10,
    nudgeEveryMin: 12,
    denyEntertainmentGrants: false,
  },
  balanced: {
    challengeOn: ["unrelated", "uncertain"],
    timerSec: 10,
    maxRounds: 2,
    uncertainTolerance: 2,
    grantMaxMin: 15,
    grantDefaultMin: 10,
    breakBudgetMin: 15,
    minStudyBeforeBreakMin: 10,
    maxSingleBreakMin: 10,
    nudgeEveryMin: 10,
    denyEntertainmentGrants: false,
  },
  strict: {
    challengeOn: ["unrelated", "uncertain"],
    timerSec: 7,
    maxRounds: 2,
    uncertainTolerance: 1,
    grantMaxMin: 10,
    grantDefaultMin: 5,
    breakBudgetMin: 10,
    minStudyBeforeBreakMin: 15,
    maxSingleBreakMin: 5,
    nudgeEveryMin: 15,
    denyEntertainmentGrants: true,
  },
};

export function normalizeLevel(raw: unknown): InterventionLevel {
  return raw === "passive" || raw === "gentle" || raw === "strict" ? raw : "balanced";
}

export function isLevel(raw: unknown): raw is InterventionLevel {
  return raw === "passive" || raw === "gentle" || raw === "balanced" || raw === "strict";
}

export interface PolicyInput {
  level: InterventionLevel;
  category: IntentCategory;
  /** active temporary access already covers this domain */
  hasGrant: boolean;
  /** consecutive uncertain navigations before this one (Balanced persistence rule) */
  uncertainStreak: number;
  /** a challenge is already open for this navigation/tab */
  challengeOpen: boolean;
}

export type PolicyAction = "allow" | "challenge" | "log";

export interface PolicyDecision {
  action: PolicyAction;
  why: string;
}

/** Pure decision: category + level + context -> allow / challenge / log-only. */
export function decidePolicy(input: PolicyInput): PolicyDecision {
  const lv = LEVELS[input.level];
  if (input.hasGrant) return { action: "allow", why: "active temporary access covers this domain" };
  if (input.challengeOpen) return { action: "log", why: "a challenge is already open" };
  if (lv.challengeOn.length === 0) return { action: "log", why: "passive mode: monitoring only" };
  if (input.category === "relevant") return { action: "allow", why: "activity supports the goal" };
  if (input.category === "unrelated") return { action: "challenge", why: "activity appears unrelated to the goal" };
  // uncertain: challenge only once persistence passes the level's tolerance
  if (input.uncertainStreak >= lv.uncertainTolerance)
    return { action: "challenge", why: "distraction persisted past the tolerated streak" };
  return { action: "allow", why: "isolated uncertain activity is tolerated at this level" };
}
