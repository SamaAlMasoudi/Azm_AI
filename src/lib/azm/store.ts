/* Azm — central client store: profile isolation, session machine, timer,
 * simulated browser, intent-based interception, dialogues, grants, AI memory,
 * floating-orb chat. */

"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type {
  ActiveSession,
  AiEndDecision,
  AiVerification,
  BreakResult,
  ChallengeDTO,
  ChatLine,
  GrantDTO,
  Lang,
  MemoryDTO,
  NavDestination,
  Personality,
  ProfileDTO,
  SessionConfig,
  SessionGroupDTO,
  SessionReportData,
  SessionSummaryData,
  SetupDraft,
} from "./types";
import { treeStageFor, TECHNIQUE_PRESETS } from "./types";
import { LEVELS, type InterventionLevel } from "./policy";
import { resolveDestination, searchDestination } from "./urls";
import { voice } from "./messages";
import * as api from "./api";
import { getDict } from "./i18n";
import { importProfileCode, storeProfileCode, forgetProfileCode } from "./profile-client";

export type View = "dashboard" | "setup" | "session" | "analytics" | "summary" | "settings";

export type TimerPhase = "work" | "break";
export type BreakKind = "technique" | "agent";

export interface InterceptionState {
  challenge: ChallengeDTO;
  phase: "justify" | "evaluating" | "verdict";
  result: {
    status: "granted" | "denied" | "timeout";
    message: string;
    minutes?: number;
    classification?: "supportive" | "uncertain" | "distracting";
    source: "ai" | "heuristic";
  } | null;
}

export interface DialogState {
  kind: "break" | "end" | "verify";
  stage: "input" | "thinking" | "result";
  text: string;
  result: BreakResult | AiEndDecision | AiVerification | null;
  message: string;
  lines: ChatLine[];
  round: number;
  maxRounds: number;
}

export interface OrbChatState {
  open: boolean;
  thinking: boolean;
  lines: ChatLine[];
}

interface AzmStore {
  lang: Lang;
  defaultPersonality: Personality;
  view: View;

  profile: ProfileDTO | null;
  /** why the profile (workspace code, pairing token) could not be loaded — null when fine */
  profileError: string | null;
  memory: MemoryDTO[];
  grants: GrantDTO[];
  orbChat: OrbChatState;

  draft: SetupDraft;
  editingGroupId: string | null;
  groups: SessionGroupDTO[];
  groupsLoaded: boolean;

  active: ActiveSession | null;
  timerPhase: TimerPhase;
  breakKind: BreakKind;
  preBreakSecondsLeft: number | null;
  secondsLeft: number;
  tickCount: number;
  lastBreakEndedAt: number | null;
  nudgeAt: number; // focused seconds threshold for next nudge
  summary: SessionSummaryData | null;

  browserHistory: string[];
  browserIdx: number;
  currentCategory: string;

  interception: InterceptionState | null;
  dialog: DialogState | null;
  weeklyPassUsed: boolean;
  bootstrapped: boolean;

  /* actions */
  bootstrap: () => Promise<void>;
  /** (re)load the profile behind this browser; resolves true on success */
  loadProfile: () => Promise<boolean>;
  setLang: (l: Lang) => void;
  setDefaultPersonality: (p: Personality) => void;
  setView: (v: View) => void;

  setInterventionLevel: (l: InterventionLevel) => Promise<void>;
  /** configurable human-intervention window (10–120s) */
  setChallengeSeconds: (n: number) => Promise<void>;
  updateAi: (patch: { aiProvider?: string; aiModel?: string; aiBaseUrl?: string; aiApiKey?: string }) => Promise<void>;
  testAi: (form?: { aiProvider: string; aiModel?: string; aiBaseUrl?: string; aiApiKey?: string }) => Promise<{ ok: boolean; ms?: number; error?: string }>;
  loadMemory: () => Promise<void>;
  addMemory: (text: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  regeneratePairing: () => Promise<void>;
  importProfile: (code: string) => Promise<boolean>;
  resetProfileData: () => Promise<void>;

  setDraft: (patch: Partial<SetupDraft>) => void;
  resetDraft: () => void;
  editGroup: (g: SessionGroupDTO) => void;
  cancelEditGroup: () => void;

  loadGroups: () => Promise<void>;
  saveGroup: () => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  startSession: () => Promise<void>;
  startFromDraft: () => Promise<void>;
  tick: () => void;
  syncNow: () => void;
  refreshGrants: () => Promise<void>;

  browserNavigate: (url: string, source?: "link" | "address_bar") => void;
  browserSearch: (query: string) => void;
  navigateGate: (url: string, source: "link" | "address_bar") => Promise<void>;
  navigateGateSearch: (query: string) => Promise<void>;
  browserBack: () => void;
  browserForward: () => void;
  browserReload: () => void;

  selfCorrect: () => void;
  submitJustification: (text: string) => Promise<void>;
  /** @param hasDraft true when the student is mid-typing — triggers grace instead of a hard timeout */
  interceptionTimeout: (hasDraft: boolean) => void;
  /** manual “+30s” extension of the intervention window */
  extendChallengeWindow: (seconds?: number) => Promise<void>;
  dismissVerdict: () => void;

  openDialog: (kind: "break" | "end" | "verify") => void;
  setDialogText: (t: string) => void;
  sendBreakRequest: () => Promise<void>;
  sendEndReason: () => Promise<void>;
  sendVerification: () => Promise<void>;
  closeDialog: () => void;
  confirmEnd: () => void;
  dialogToBreak: () => void;
  applyBreak: (minutes: number) => void;
  endBreakEarly: (natural?: boolean) => void;
  useEmergencyPass: () => Promise<void>;
  finalEndSession: (accomplishments?: string, verification?: AiVerification, passUsed?: boolean) => Promise<void>;

  openOrbChat: () => void;
  closeOrbChat: () => void;
  sendOrbChat: (text: string) => Promise<void>;

  refreshPassStatus: () => Promise<void>;
  gotoSummary: () => void;
}

const emptyDraft = (personality: Personality): SetupDraft => ({
  name: "",
  goal: "",
  task: "",
  expectedOutcome: "",
  technique: "pomodoro",
  workMinutes: 25,
  breakMinutes: 5,
  personality,
  allowedSites: [],
});

let syncCounter = 0;
let grantCounter = 0;

/* ---------- cross-navigation persistence (survives view switches AND reloads) ---------- */

const ORB_CHAT_KEY = "azm-orb-chat";
const VIEW_KEY = "azm-view";
const BROWSER_KEY = "azm-browser-state";
const VIEWS: View[] = ["dashboard", "setup", "session", "analytics", "summary", "settings"];

/** Keep the last ~50 orb lines so the conversation survives reloads. */
function persistOrbChat(c: OrbChatState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORB_CHAT_KEY, JSON.stringify({ lines: c.lines.slice(-50) }));
  } catch {
    /* storage full/blocked — conversation stays in memory */
  }
}

function readOrbChatLines(): ChatLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORB_CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return [];
    return parsed.lines
      .filter((l): l is ChatLine => {
        if (!l || typeof l !== "object") return false;
        const c = l as ChatLine;
        return (c.role === "user" || c.role === "azm") && typeof c.text === "string";
      })
      .slice(-50);
  } catch {
    return [];
  }
}

function persistView(v: View) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    /* ignore */
  }
}

/** Last open tab; null when missing or stale (e.g. "summary" with no data). */
function readSavedView(): View | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    return v && VIEWS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function persistBrowserState(history: string[], idx: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BROWSER_KEY, JSON.stringify({ history, idx }));
  } catch {
    /* ignore */
  }
}

function readBrowserState(): { history: string[]; idx: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BROWSER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { history?: unknown; idx?: unknown };
    if (!Array.isArray(parsed.history) || parsed.history.length === 0) return null;
    const history = parsed.history.filter((u): u is string => typeof u === "string" && u.length > 0);
    const idx = typeof parsed.idx === "number" && Number.isInteger(parsed.idx) ? parsed.idx : 0;
    if (history.length === 0 || idx < 0 || idx >= history.length) return null;
    return { history, idx };
  } catch {
    return null;
  }
}

function clearBrowserState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(BROWSER_KEY);
  } catch {
    /* ignore */
  }
}

function persistLang(l: Lang) {
  if (typeof window !== "undefined") localStorage.setItem("azm-lang", l);
}
function readLang(): Lang {
  if (typeof window === "undefined") return "ar";
  return (localStorage.getItem("azm-lang") as Lang) || "ar";
}
function persistPersonality(p: Personality) {
  if (typeof window !== "undefined") localStorage.setItem("azm-personality", p);
}
function readPersonality(): Personality {
  if (typeof window === "undefined") return "strict";
  return (localStorage.getItem("azm-personality") as Personality) || "strict";
}

export const useAzm = create<AzmStore>((set, get) => ({
  lang: "ar",
  defaultPersonality: "strict",
  view: "dashboard",

  profile: null,
  profileError: null,
  memory: [],
  grants: [],
  orbChat: { open: false, thinking: false, lines: [] },

  draft: emptyDraft("strict"),
  editingGroupId: null,
  groups: [],
  groupsLoaded: false,

  active: null,
  timerPhase: "work",
  breakKind: "technique",
  preBreakSecondsLeft: null,
  secondsLeft: 0,
  tickCount: 0,
  lastBreakEndedAt: null,
  nudgeAt: 600,
  summary: null,

  browserHistory: ["youtube.com"],
  browserIdx: 0,
  currentCategory: "education",

  interception: null,
  dialog: null,
  weeklyPassUsed: false,
  bootstrapped: false,

  /* ---------- lifecycle ---------- */

  bootstrap: async () => {
    if (get().bootstrapped) return;
    const lang = readLang();
    const personality = readPersonality();
    set({
      lang,
      defaultPersonality: personality,
      draft: { ...emptyDraft(personality) },
      bootstrapped: true,
      // restore the floating companion's conversation — it must survive
      // navigation and full reloads like the rest of the session
      orbChat: { open: false, thinking: false, lines: readOrbChatLines() },
    });

    // isolated workspace: get-or-create the profile behind this browser
    // (one quiet retry — a cold server often needs a second to wake up)
    if (!(await get().loadProfile())) {
      await new Promise((r) => setTimeout(r, 1500));
      await get().loadProfile();
    }
    const loaded = get().profile;
    if (loaded && loaded.lang && document.documentElement.lang !== loaded.lang && !localStorage.getItem("azm-lang")) {
      get().setLang(loaded.lang);
    }

    // Resume an active session if one exists
    try {
      const { session } = await api.apiGetActiveSession();
      if (session) {
        const workSec = session.workMinutes * 60;
        const rounds = Math.floor(session.focusedSeconds / workSec) + 1;
        const into = session.focusedSeconds % workSec;
        // restore the simulated browsing position (current page + history)
        // from before the reload; fall back to the first allowed site
        const saved = readBrowserState();
        const history = saved?.history ?? [session.allowedSites[0]?.raw ?? "youtube.com"];
        const idx = saved ? Math.min(saved.idx, history.length - 1) : 0;
        set({
          active: session,
          timerPhase: "work",
          secondsLeft: Math.max(5, workSec - into),
          browserHistory: history,
          browserIdx: idx,
          nudgeAt: Math.floor(session.focusedSeconds / 600) * 600 + 600,
        });
        void get().refreshGrants();
        void get().refreshPassStatus();
        toast.info(getDict(lang).session.resumedToast);
      } else {
        void get().refreshPassStatus();
      }
    } catch {
      void get().refreshPassStatus();
    }

    // reopen the tab the student was on; stale tabs fall back to the dashboard
    const savedView = readSavedView();
    if (savedView) {
      let view: View = savedView;
      if ((view === "session" && !get().active) || (view === "summary" && !get().summary)) {
        view = "dashboard";
      }
      set({ view });
    }
  },

  loadProfile: async () => {
    try {
      const { profile } = await api.apiGetProfile();
      storeProfileCode(profile.code);
      set({ profile, profileError: null });
      return true;
    } catch (e) {
      // offline-tolerant, but never silent: Settings shows why there is no workspace code
      set({ profileError: api.describeApiFailure(e) });
      return false;
    }
  },

  setLang: (l) => {
    set({ lang: l });
    persistLang(l);
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    }
    void api.apiUpdateProfile({ lang: l }).catch(() => {});
  },

  setDefaultPersonality: (p) => {
    set({ defaultPersonality: p, draft: { ...get().draft, personality: p } });
    persistPersonality(p);
  },

  setView: (v) => {
    set({ view: v });
    persistView(v);
  },

  /* ---------- profile settings ---------- */

  setInterventionLevel: async (l) => {
    try {
      const { profile } = await api.apiUpdateProfile({ interventionLevel: l });
      set({ profile });
      const d = getDict(get().lang);
      toast.success(d.toasts.levelSaved);
      // apply immediately to the running session too
      const a = get().active;
      if (a) set({ active: { ...a, level: l } });
    } catch {
      toast.error(getDict(get().lang).toasts.networkError);
    }
  },

  setChallengeSeconds: async (n) => {
    try {
      const { profile } = await api.apiUpdateProfile({ challengeSeconds: n });
      set({ profile });
    } catch {
      toast.error(getDict(get().lang).toasts.networkError);
    }
  },

  updateAi: async (patch) => {
    try {
      const { profile } = await api.apiUpdateProfile(patch);
      set({ profile });
    } catch (e) {
      toast.error(`${getDict(get().lang).toasts.networkError} ${api.describeApiFailure(e)}`);
    }
  },

  testAi: async (form) => {
    try {
      return form ? await api.apiTestProviderForm(form) : await api.apiTestProvider();
    } catch (e) {
      // say WHY: unreachable server vs. missing route vs. server fault (never a blanket "network error")
      return { ok: false, error: api.describeApiFailure(e) };
    }
  },

  loadMemory: async () => {
    try {
      const { memory } = await api.apiMemory();
      set({ memory });
    } catch {
      /* keep previous */
    }
  },

  addMemory: async (text) => {
    const d = getDict(get().lang);
    try {
      await api.apiAddMemory(text);
      toast.success(d.toasts.memorySaved);
      await get().loadMemory();
    } catch {
      toast.error(d.toasts.networkError);
    }
  },

  deleteMemory: async (id) => {
    try {
      await api.apiDeleteMemory(id);
      await get().loadMemory();
    } catch {
      /* ignore */
    }
  },

  regeneratePairing: async () => {
    const d = getDict(get().lang);
    try {
      const { pairingToken } = await api.apiRegeneratePairing();
      const cur = get().profile;
      if (cur) {
        set({ profile: { ...cur, pairingToken, extConnected: false } });
      } else {
        // no profile in memory (bootstrap had failed) — fetch it so the new token is visible
        await get().loadProfile();
      }
      toast.success(d.toasts.tokenRegenerated);
    } catch (e) {
      toast.error(`${d.toasts.networkError} ${api.describeApiFailure(e)}`);
    }
  },

  importProfile: async (code) => {
    const d = getDict(get().lang);
    if (!importProfileCode(code)) {
      toast.error(d.profileIso.invalidCode);
      return false;
    }
    try {
      const { profile } = await api.apiGetProfile();
      storeProfileCode(profile.code);
      set({ profile });
      toast.success(d.profileIso.imported);
      // reload data of the imported workspace
      await get().loadGroups();
      await get().loadMemory();
      void get().refreshPassStatus();
      return true;
    } catch {
      toast.error(d.toasts.networkError);
      return false;
    }
  },

  resetProfileData: async () => {
    try {
      await api.apiResetAll();
      set({ active: null, summary: null, grants: [], memory: [], weeklyPassUsed: false });
    } catch {
      /* ignore */
    }
  },

  /* ---------- draft / groups ---------- */

  setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),

  resetDraft: () =>
    set({ draft: emptyDraft(get().defaultPersonality), editingGroupId: null }),

  editGroup: (g) => {
    set({
      editingGroupId: g.id,
      draft: {
        name: g.name,
        goal: g.goal,
        task: g.task,
        expectedOutcome: g.expectedOutcome,
        technique: g.technique,
        workMinutes: g.workMinutes,
        breakMinutes: g.breakMinutes,
        personality: g.personality,
        allowedSites: g.allowedSites,
      },
      view: "setup",
    });
    persistView("setup");
  },

  cancelEditGroup: () => set({ editingGroupId: null }),

  loadGroups: async () => {
    try {
      const { groups } = await api.apiListGroups();
      set({ groups, groupsLoaded: true });
    } catch {
      set({ groupsLoaded: true });
    }
  },

  saveGroup: async () => {
    const { draft, editingGroupId, lang } = get();
    const d = getDict(lang);
    if (!draft.name.trim()) {
      toast.error(d.setup.groupNamePlaceholder);
      return;
    }
    const g: SessionGroupDTO = {
      id: editingGroupId ?? "",
      name: draft.name.trim(),
      goal: draft.goal,
      task: draft.task,
      expectedOutcome: draft.expectedOutcome,
      technique: draft.technique,
      workMinutes: draft.workMinutes,
      breakMinutes: draft.breakMinutes,
      personality: draft.personality,
      allowedSites: draft.allowedSites,
      createdAt: new Date().toISOString(),
    };
    try {
      await api.apiSaveGroup(g);
      toast.success(d.toasts.groupSaved);
      await get().loadGroups();
    } catch {
      toast.error(d.toasts.networkError);
    }
  },

  deleteGroup: async (id) => {
    const d = getDict(get().lang);
    try {
      await api.apiDeleteGroup(id);
      toast.success(d.toasts.groupDeleted);
      await get().loadGroups();
    } catch {
      toast.error(d.toasts.networkError);
    }
  },

  /* ---------- session lifecycle ---------- */

  startFromDraft: () => get().startSession(),

  startSession: async () => {
    const { draft, active, lang } = get();
    const d = getDict(lang);
    if (active) {
      toast.error(d.session.activeElsewhere);
      set({ view: "session" });
      return;
    }
    const config: SessionConfig = {
      goal: draft.goal.trim(),
      task: draft.task.trim(),
      expectedOutcome: draft.expectedOutcome.trim(),
      technique: draft.technique,
      workMinutes: draft.workMinutes,
      breakMinutes: draft.breakMinutes,
      personality: draft.personality,
      allowedSites: draft.allowedSites,
    };
    let id = `local-${Date.now()}`;
    let startedAt = Date.now();
    let level: InterventionLevel = get().profile?.interventionLevel ?? "balanced";
    try {
      const res = await api.apiCreateSession(config);
      id = res.id;
      startedAt = new Date(res.startedAt).getTime();
      level = (["passive", "gentle", "balanced", "strict"].includes(res.level) ? res.level : "balanced") as InterventionLevel;
    } catch {
      /* offline-tolerant: continue locally */
    }
    const startUrl = draft.allowedSites[0]?.raw ?? "youtube.com";
    set({
      active: {
        id,
        ...config,
        level,
        startedAt,
        focusedSeconds: 0,
        breakSeconds: 0,
        breakUsedSeconds: 0,
        breakUntil: null,
        distractionAttempts: 0,
        interventionsBlocked: 0,
        interventionsApproved: 0,
        interventionsUncertain: 0,
        rounds: 1,
        emergencyPassUsed: false,
      },
      timerPhase: "work",
      breakKind: "technique",
      preBreakSecondsLeft: null,
      secondsLeft: draft.workMinutes * 60,
      browserHistory: [startUrl],
      browserIdx: 0,
      view: "session",
      interception: null,
      dialog: null,
      nudgeAt: LEVELS[level].nudgeEveryMin * 60,
      tickCount: 0,
      lastBreakEndedAt: null,
      grants: [],
    });
    persistBrowserState([startUrl], 0);
    persistView("session");
    toast.success(d.session.startedToast);
    const v = voice(config.personality, lang);
    setTimeout(() => toast(v.sessionStart()), 900);
    void get().refreshPassStatus();
  },

  tick: () => {
    const s = get();
    if (!s.active) return;
    const d = getDict(s.lang);
    const workSec = s.active.workMinutes * 60;
    const breakSec = s.active.breakMinutes * 60;

    if (s.interception?.phase === "evaluating") {
      // freeze countdown during AI evaluation of a justification
      return;
    }

    if (s.timerPhase === "work") {
      const left = s.secondsLeft - 1;
      const focused = s.active.focusedSeconds + 1;
      const stage = treeStageFor(focused);
      const prevStage = treeStageFor(s.active.focusedSeconds);
      set({
        secondsLeft: left,
        active: { ...s.active, focusedSeconds: focused, rounds: Math.floor(focused / workSec) + 1 },
        tickCount: s.tickCount + 1,
      });

      if (prevStage < stage) {
        toast.success(d.session.treeGrownToast);
      }

      // level-paced encouragement
      const nudgeEvery = LEVELS[s.active.level].nudgeEveryMin;
      if (nudgeEvery > 0 && focused >= s.nudgeAt) {
        const v = voice(s.active.personality, s.lang);
        toast(v.nudge());
        set({ nudgeAt: s.nudgeAt + nudgeEvery * 60 });
      }

      if (left <= 0) {
        // technique break (part of the cycle — not the smart-break budget)
        set({ timerPhase: "break", breakKind: "technique", secondsLeft: breakSec });
        toast.info(d.session.techniqueBreakToast);
      }
    } else {
      const left = s.secondsLeft - 1;
      set({
        secondsLeft: left,
        active: { ...s.active, breakSeconds: s.active.breakSeconds + 1 },
        tickCount: s.tickCount + 1,
      });
      if (left <= 0) {
        if (s.breakKind === "agent") {
          get().endBreakEarly(true);
          return;
        }
        set({ timerPhase: "work", secondsLeft: workSec, lastBreakEndedAt: Date.now() });
        toast.info(d.session.breakOverToast);
      }
    }

    // periodic server sync + grants refresh
    const current = get().active;
    if (current && !current.id.startsWith("local-")) {
      syncCounter += 1;
      if (syncCounter >= 20) {
        syncCounter = 0;
        get().syncNow();
      }
      grantCounter += 1;
      if (grantCounter >= 12) {
        grantCounter = 0;
        void get().refreshGrants();
      }
    }
  },

  syncNow: () => {
    const a = get().active;
    if (!a || a.id.startsWith("local-")) return;
    api
      .apiSyncSession(a.id, {
        focusedSeconds: a.focusedSeconds,
        breakSeconds: a.breakSeconds,
        breakUsedSeconds: a.breakUsedSeconds,
        breakUntil: get().timerPhase === "break" && get().breakKind === "agent" && get().secondsLeft > 0
          ? Date.now() + get().secondsLeft * 1000
          : null,
        distractionAttempts: a.distractionAttempts,
        interventionsBlocked: a.interventionsBlocked,
        interventionsApproved: a.interventionsApproved,
        interventionsUncertain: a.interventionsUncertain,
        rounds: a.rounds,
        treeStage: treeStageFor(a.focusedSeconds),
      })
      .catch(() => {});
  },

  refreshGrants: async () => {
    try {
      const { grants } = await api.apiGrants();
      set({ grants });
    } catch {
      /* keep previous */
    }
  },

  /* ---------- simulated browser (agent-gated navigation) ---------- */

  browserNavigate: (url, source = "link") => {
    void get().navigateGate(url, source);
  },

  browserSearch: (query) => {
    void get().navigateGateSearch(query);
  },

  navigateGate: async (url: string, source: "link" | "address_bar") => {
    const s = get();
    if (!s.active) return;
    const dest = resolveDestination(url);
    set({ currentCategory: dest.category });
    let result;
    try {
      result = await api.apiNavigate({ url: dest.url, title: dest.title, category: dest.category, source, lang: s.lang });
    } catch {
      // offline-tolerant: stay where we are
      return;
    }
    // session or focus may have changed while the agent was thinking
    if (!get().active || get().active!.id !== s.active!.id) return;
    if (result.decision === "allow") {
      const history = [...get().browserHistory.slice(0, get().browserIdx + 1), dest.url];
      const idx = get().browserIdx + 1;
      set({ browserHistory: history, browserIdx: idx, interception: null });
      persistBrowserState(history, idx);
      return;
    }
    if (result.challenge) {
      set({
        interception: {
          challenge: result.challenge,
          phase: "justify",
          result: null,
        },
        active: { ...get().active!, distractionAttempts: get().active!.distractionAttempts + 1 },
      });
    }
  },

  navigateGateSearch: async (query: string) => {
    const s = get();
    if (!s.active) return;
    const dest = searchDestination(query);
    set({ currentCategory: dest.category });
    let result;
    try {
      result = await api.apiNavigate({ url: dest.url, title: dest.title, category: dest.category, source: "search", lang: s.lang });
    } catch {
      return;
    }
    if (!get().active || get().active!.id !== s.active!.id) return;
    if (result.decision === "allow") {
      const history = [...get().browserHistory.slice(0, get().browserIdx + 1), dest.url];
      const idx = get().browserIdx + 1;
      set({ browserHistory: history, browserIdx: idx, interception: null });
      persistBrowserState(history, idx);
      return;
    }
    if (result.challenge) {
      set({
        interception: {
          challenge: result.challenge,
          phase: "justify",
          result: null,
        },
        active: { ...get().active!, distractionAttempts: get().active!.distractionAttempts + 1 },
      });
    }
  },

  browserBack: () => {
    const { browserHistory, browserIdx } = get();
    if (browserIdx > 0) {
      set({ browserIdx: browserIdx - 1 });
      persistBrowserState(browserHistory, browserIdx - 1);
    }
  },
  browserForward: () => {
    const { browserHistory, browserIdx } = get();
    if (browserIdx < browserHistory.length - 1) {
      set({ browserIdx: browserIdx + 1 });
      persistBrowserState(browserHistory, browserIdx + 1);
    }
  },
  browserReload: () => set({ browserHistory: [...get().browserHistory] }),

  /* ---------- interception (challenge conversation) ---------- */

  selfCorrect: () => {
    const s = get();
    if (!s.interception || !s.active) return;
    const d = getDict(s.lang);
    const i = s.interception;
    api
      .apiRecordIntervention({
        sessionId: s.active.id,
        siteName: i.challenge.title || i.challenge.domain,
        siteUrl: i.challenge.url,
        category: i.challenge.category,
        explanation: "",
        verdict: "self_corrected",
        classification: "none",
        aiMessage: "",
        source: "link",
        aiSource: "heuristic",
      })
      .catch(() => {});
    set({ interception: null });
    toast.info(d.interception.selfCorrectedToast);
  },

  interceptionTimeout: (hasDraft: boolean) => {
    const s = get();
    if (!s.interception || !s.active) return;
    if (s.interception.phase !== "justify") return;
    const i = s.interception;
    const d = getDict(s.lang);

    // Grace-while-typing: never cut off an in-progress justification.
    if (hasDraft) {
      void (async () => {
        let r: { ok: boolean; deadline: number | null; extensions: number };
        try {
          r = await api.apiExtendChallenge(i.challenge.id);
        } catch {
          r = { ok: false, deadline: null, extensions: 0 };
        }
        const cur = get().interception;
        if (cur?.phase !== "justify") return; // student already submitted
        if (r.ok && r.deadline) {
          set({
            interception: {
              ...cur,
              challenge: { ...cur.challenge, deadline: r.deadline, timerSec: i.challenge.timerSec, extensions: r.extensions },
            },
          });
          toast.info(d.interception.graceToast);
          return;
        }
        // no extensions left and still silent-ish: proceed to the honest timeout
        set({ interception: { ...cur, phase: "evaluating" } });
        try {
          await api.apiAgentTimeout(i.challenge.id, s.lang);
        } catch {
          /* record locally regardless */
        }
        const a = get().active;
        if (!a) return;
        set({
          interception: {
            challenge: { ...cur.challenge, status: "timeout" },
            phase: "verdict",
            result: { status: "timeout", message: "", classification: "distracting", source: "heuristic" },
          },
          active: { ...a, interventionsBlocked: a.interventionsBlocked + 1 },
        });
      })();
      return;
    }

    // silent student: the automated timeout path (unchanged behavior)
    set({ interception: { ...i, phase: "evaluating" } });
    void (async () => {
      let result;
      try {
        result = await api.apiAgentTimeout(i.challenge.id, s.lang);
      } catch {
        result = { status: "timeout", message: "", source: "heuristic" };
      }
      const a = get().active;
      if (!a) return;
      set({
        interception: {
          challenge: { ...i.challenge, status: "timeout" },
          phase: "verdict",
          result: { status: "timeout", message: result.message, classification: "distracting", source: "heuristic" },
        },
        active: { ...a, interventionsBlocked: a.interventionsBlocked + 1 },
      });
    })();
  },

  extendChallengeWindow: async (seconds) => {
    const s = get();
    if (!s.interception || s.interception.phase !== "justify") return;
    const d = getDict(s.lang);
    try {
      const r = await api.apiExtendChallenge(s.interception.challenge.id, seconds);
      const cur = get().interception;
      if (!cur || cur.phase !== "justify") return;
      if (r.ok && r.deadline) {
        set({ interception: { ...cur, challenge: { ...cur.challenge, deadline: r.deadline, extensions: r.extensions } } });
        toast.info(d.interception.extendedToast);
      } else {
        toast.error(r.reason === "max-extensions" ? d.interception.maxExtToast : d.toasts.networkError);
      }
    } catch {
      toast.error(d.toasts.networkError);
    }
  },

  submitJustification: async (text) => {
    const s = get();
    if (!s.interception || !s.active) return;
    const i = s.interception;
    if (i.phase !== "justify") return;
    set({ interception: { ...i, phase: "evaluating" } });
    let result;
    try {
      result = await api.apiJustify(i.challenge.id, text);
    } catch {
      const v = voice(s.active.personality, s.lang);
      const escalation = s.active.interventionsBlocked >= 2;
      result = {
        status: "denied",
        message: escalation ? v.escalation() : v.rejected(),
        source: "heuristic",
      };
    }
    const a = get().active;
    if (!a) return;

    if (result.status === "asking" && result.message) {
      // agent asked ONE concrete follow-up — new countdown round
      const lines = [...i.challenge.lines, { role: "user" as const, text }, { role: "azm" as const, text: result.message }];
      const deadline = result.deadline ?? Date.now() + i.challenge.timerSec * 1000;
      set({
        interception: {
          challenge: { ...i.challenge, lines, round: result.round ?? i.challenge.round + 1, deadline, status: "asking" },
          phase: "justify",
          result: null,
        },
      });
      if (result.memorySaved) toast.info(getDict(s.lang).toasts.memorySaved);
      return;
    }

    if (result.status === "granted") {
      const lines = [...i.challenge.lines, { role: "user" as const, text }, { role: "azm" as const, text: result.message }];
      set({
        interception: {
          challenge: { ...i.challenge, lines, status: "granted" },
          phase: "verdict",
          result: {
            status: "granted",
            message: result.message,
            minutes: result.minutes,
            classification: result.classification,
            source: result.source,
          },
        },
        active: {
          ...a,
          interventionsApproved:
            a.interventionsApproved + (result.classification === "supportive" ? 1 : 0),
          interventionsUncertain:
            a.interventionsUncertain + (result.classification === "uncertain" ? 1 : 0),
        },
      });
      if (result.grant) {
        void get().refreshGrants();
      }
      if (result.memorySaved) toast.info(getDict(s.lang).toasts.memorySaved);
      return;
    }

    // denied / timeout
    const lines = [...i.challenge.lines, { role: "user" as const, text }, { role: "azm" as const, text: result.message }];
    set({
      interception: {
        challenge: { ...i.challenge, lines, status: "denied" },
        phase: "verdict",
        result: { status: result.status === "timeout" ? "timeout" : "denied", message: result.message, classification: "distracting", source: result.source },
      },
      active: { ...a, interventionsBlocked: a.interventionsBlocked + 1 },
    });
    if (result.memorySaved) toast.info(getDict(s.lang).toasts.memorySaved);
  },

  dismissVerdict: () => {
    const s = get();
    const i = s.interception;
    if (!i || !s.active) return;
    const d = getDict(s.lang);
    const allowed = i.result?.status === "granted";
    if (allowed) {
      const history = [...s.browserHistory.slice(0, s.browserIdx + 1), i.challenge.url];
      const idx = s.browserIdx + 1;
      set({ interception: null, browserHistory: history, browserIdx: idx });
      persistBrowserState(history, idx);
      toast.success(d.interception.allowedToast);
    } else {
      set({ interception: null });
      toast.error(d.interception.blockedToast);
    }
  },

  /* ---------- dialogues ---------- */

  openDialog: (kind) => {
    // session protection: an active authorization challenge owns the screen —
    // its countdown keeps running, so stacking another dialogue on top would
    // make the justification field unreachable and end in an unfair timeout
    if (get().interception) {
      toast.error(getDict(get().lang).interception.finishFirst);
      return;
    }
    set({ dialog: { kind, stage: "input", text: "", result: null, message: "", lines: [], round: 1, maxRounds: 2 } });
  },

  setDialogText: (t) => {
    const d = get().dialog;
    if (d) set({ dialog: { ...d, text: t } });
  },

  closeDialog: () => set({ dialog: null }),

  dialogToBreak: () =>
    set({ dialog: { kind: "break", stage: "input", text: "", result: null, message: "", lines: [], round: 1, maxRounds: 2 } }),

  sendBreakRequest: async () => {
    const s = get();
    if (!s.active || !s.dialog) return;
    const d = getDict(s.lang);
    const v = voice(s.active.personality, s.lang);
    set({ dialog: { ...s.dialog, stage: "thinking" } });
    let decision: BreakResult;
    try {
      decision = await api.apiBreakRequest({
        lang: s.lang,
        personality: s.active.personality,
        session: {
          goal: s.active.goal,
          task: s.active.task,
          focusedMinutes: Math.floor(s.active.focusedSeconds / 60),
          plannedMinutes: s.active.workMinutes,
        },
        request: s.dialog.text,
      });
    } catch {
      const lv = LEVELS[s.active.level];
      const focusedMin = Math.floor(s.active.focusedSeconds / 60);
      const budgetLeft = lv.breakBudgetMin - Math.round(s.active.breakUsedSeconds / 60);
      if (focusedMin >= lv.minStudyBeforeBreakMin && budgetLeft > 0) {
        decision = { status: "granted", minutes: Math.min(5, lv.maxSingleBreakMin, budgetLeft), message: v.breakGranted(), source: "heuristic" };
      } else {
        decision = { status: "denied", message: v.breakDenied(), source: "heuristic" };
      }
    }
    const dialog = get().dialog;
    if (!dialog) return;

    if (decision.status === "asking" && decision.message) {
      const lines = [...dialog.lines, { role: "user" as const, text: dialog.text }, { role: "azm" as const, text: decision.message }];
      set({
        dialog: {
          ...dialog,
          stage: "input",
          text: "",
          lines,
          round: decision.round ?? dialog.round + 1,
          maxRounds: decision.maxRounds ?? dialog.maxRounds,
        },
      });
      return;
    }
    set({
      dialog: {
        ...dialog,
        stage: "result",
        result: decision,
        message: decision.message,
        lines: [...dialog.lines, { role: "user" as const, text: dialog.text }],
      },
    });
  },

  applyBreak: (minutes: number) => {
    const s = get();
    if (!s.active) return;
    const d = getDict(s.lang);
    set({
      dialog: null,
      timerPhase: "break",
      breakKind: "agent",
      preBreakSecondsLeft: s.secondsLeft,
      secondsLeft: minutes * 60,
      active: { ...s.active, breakUsedSeconds: s.active.breakUsedSeconds + minutes * 60 },
    });
    toast.info(`${d.dialog.breakGranted} — ${minutes} ${d.dialog.breakMinutes}`);
    get().syncNow();
  },

  endBreakEarly: (natural = false) => {
    const s = get();
    if (!s.active || s.timerPhase !== "break" || s.breakKind !== "agent") return;
    const d = getDict(s.lang);
    // unused whole minutes go back into the smart-break budget
    const unusedMin = natural ? 0 : Math.floor(s.secondsLeft / 60);
    const restored =
      s.preBreakSecondsLeft ?? s.active.workMinutes * 60;
    set({
      timerPhase: "work",
      breakKind: "technique",
      preBreakSecondsLeft: null,
      secondsLeft: Math.max(5, restored),
      lastBreakEndedAt: Date.now(),
      active: {
        ...s.active,
        breakUsedSeconds: Math.max(0, s.active.breakUsedSeconds - unusedMin * 60),
        breakUntil: null,
      },
    });
    toast.info(natural ? d.session.breakOverToast : d.session.breakEndedEarly);
    get().syncNow();
  },

  sendEndReason: async () => {
    const s = get();
    if (!s.active || !s.dialog) return;
    set({ dialog: { ...s.dialog, stage: "thinking" } });
    let decision: AiEndDecision;
    const workSec = s.active.workMinutes * 60;
    const remainingMin = Math.max(0, Math.round((workSec - s.secondsLeft) / 60));
    try {
      decision = await api.apiEndDialogue({
        lang: s.lang,
        personality: s.active.personality,
        session: {
          goal: s.active.goal,
          task: s.active.task,
          expectedOutcome: s.active.expectedOutcome,
          plannedMinutes: s.active.workMinutes,
          focusedMinutes: Math.floor(s.active.focusedSeconds / 60),
          remainingMinutes: remainingMin,
          attempts: s.active.distractionAttempts,
        },
        reason: s.dialog.text,
        hasPass: !s.weeklyPassUsed,
      });
    } catch {
      decision = {
        action: "allow_end",
        message: getDict(s.lang).session.endEarlyConfirm,
        source: "heuristic",
      };
    }
    set({ dialog: { ...get().dialog!, stage: "result", result: decision, message: decision.message } });
  },

  confirmEnd: () =>
    set({ dialog: { kind: "verify", stage: "input", text: "", result: null, message: "", lines: [], round: 1, maxRounds: 2 } }),

  sendVerification: async () => {
    const s = get();
    if (!s.active || !s.dialog) return;
    set({ dialog: { ...s.dialog, stage: "thinking" } });
    let verification: AiVerification;
    try {
      verification = await api.apiVerify({
        lang: s.lang,
        personality: s.active.personality,
        expectedOutcome: s.active.expectedOutcome,
        accomplishments: s.dialog.text,
        focusedMinutes: Math.floor(s.active.focusedSeconds / 60),
        plannedMinutes: s.active.workMinutes,
        blockedAttempts: s.active.interventionsBlocked,
      });
    } catch {
      const focusedMin = Math.floor(s.active.focusedSeconds / 60);
      const ratio = focusedMin / Math.max(1, s.active.workMinutes);
      verification = {
        verdict: ratio >= 0.9 ? "achieved" : ratio >= 0.5 ? "partial" : "not_achieved",
        message: getDict(s.lang).toasts.aiFallback,
        source: "heuristic",
      };
    }
    await get().finalEndSession(s.dialog.text, verification);
  },

  useEmergencyPass: async () => {
    const s = get();
    if (!s.active) return;
    const d = getDict(s.lang);
    if (s.weeklyPassUsed) return;
    try {
      await api.apiUsePass(s.active.id);
    } catch {
      toast.error(d.toasts.networkError);
      return;
    }
    set({ weeklyPassUsed: true });
    await get().finalEndSession(undefined, undefined, true);
    toast.warning(d.toasts.passUsed);
  },

  finalEndSession: async (accomplishments, verification, passUsed = false) => {
    const s = get();
    if (!s.active) return;
    const snapshot = {
      focusedSeconds: s.active.focusedSeconds,
      breakSeconds: s.active.breakSeconds,
      breakUsedSeconds: s.active.breakUsedSeconds,
      distractionAttempts: s.active.distractionAttempts,
      interventionsBlocked: s.active.interventionsBlocked,
      interventionsApproved: s.active.interventionsApproved,
      interventionsUncertain: s.active.interventionsUncertain,
      rounds: s.active.rounds,
      treeStage: treeStageFor(s.active.focusedSeconds),
    };
    let report: SessionReportData | null = null;
    try {
      const res = await api.apiEndSession(s.active.id, {
        snapshot,
        emergencyPassUsed: passUsed || s.active.emergencyPassUsed,
        accomplishments,
        verification,
      });
      report = (res as { report?: SessionReportData }).report ?? null;
    } catch {
      /* local session can still end */
    }
    const summary: SessionSummaryData = {
      sessionId: s.active.id,
      config: {
        goal: s.active.goal,
        task: s.active.task,
        expectedOutcome: s.active.expectedOutcome,
        technique: s.active.technique,
        workMinutes: s.active.workMinutes,
        breakMinutes: s.active.breakMinutes,
        personality: s.active.personality,
        allowedSites: s.active.allowedSites,
      },
      startedAt: s.active.startedAt,
      endedAt: Date.now(),
      focusedSeconds: s.active.focusedSeconds,
      breakSeconds: s.active.breakSeconds,
      breakUsedSeconds: s.active.breakUsedSeconds,
      distractionAttempts: s.active.distractionAttempts,
      interventionsBlocked: s.active.interventionsBlocked,
      interventionsApproved: s.active.interventionsApproved,
      interventionsUncertain: s.active.interventionsUncertain,
      rounds: s.active.rounds,
      emergencyPassUsed: passUsed || s.active.emergencyPassUsed,
      treeStage: treeStageFor(s.active.focusedSeconds),
      verification: verification ?? null,
      report,
    };
    set({
      summary,
      active: null,
      timerPhase: "work",
      breakKind: "technique",
      preBreakSecondsLeft: null,
      secondsLeft: 0,
      dialog: null,
      interception: null,
      view: "summary",
      browserHistory: ["youtube.com"],
      browserIdx: 0,
      grants: [],
      // keep the conversation history — only the panel closes; the companion's
      // memory of the session remains available from every tab
      orbChat: { open: false, thinking: false, lines: get().orbChat.lines },
    });
    clearBrowserState();
    persistView("summary");
  },

  /* ---------- floating orb chat ---------- */

  openOrbChat: () => set({ orbChat: { open: true, thinking: false, lines: get().orbChat.lines } }),

  closeOrbChat: () => set({ orbChat: { ...get().orbChat, open: false } }),

  sendOrbChat: async (text) => {
    const s = get();
    if (!text.trim() || s.orbChat.thinking) return;
    const lines: ChatLine[] = [...s.orbChat.lines, { role: "user", text: text.trim() }];
    set({ orbChat: { open: true, thinking: true, lines } });
    // stream the reply live (SSE); fall back to the buffered endpoint on failure
    let streamed = false;
    try {
      const final = await api.apiChatStream(lines, s.active?.personality ?? s.defaultPersonality, (delta) => {
        const cur = get().orbChat;
        const last = cur.lines[cur.lines.length - 1];
        if (last && last.role === "azm") {
          set({ orbChat: { ...cur, lines: [...cur.lines.slice(0, -1), { ...last, text: last.text + delta }] } });
        } else {
          set({ orbChat: { ...cur, lines: [...cur.lines, { role: "azm", text: delta }] } });
        }
      });
      streamed = true;
      const cur = get().orbChat;
      const reply = final.reply || getDict(s.lang).common.aiThinking;
      const last = cur.lines[cur.lines.length - 1];
      const nextLines =
        last && last.role === "azm"
          ? [...cur.lines.slice(0, -1), { role: "azm" as const, text: reply }]
          : [...cur.lines, { role: "azm" as const, text: reply }];
      set({ orbChat: { open: true, thinking: false, lines: nextLines } });
      persistOrbChat(get().orbChat);
      if (final.memorySaved) toast.info(getDict(s.lang).toasts.memorySaved);
    } catch {
      /* streaming unsupported → buffered fallback below */
    }
    if (streamed) return;
    try {
      const res = await api.apiChat(lines, s.active?.personality ?? s.defaultPersonality);
      const reply = res.reply || getDict(s.lang).common.aiThinking;
      set({
        orbChat: {
          open: true,
          thinking: false,
          lines: [...lines, { role: "azm", text: reply }],
        },
      });
      persistOrbChat(get().orbChat);
      if (res.memorySaved) toast.info(getDict(s.lang).toasts.memorySaved);
    } catch {
      set({ orbChat: { open: true, thinking: false, lines: [...lines, { role: "azm", text: getDict(s.lang).toasts.networkError }] } });
      persistOrbChat(get().orbChat);
    }
  },

  refreshPassStatus: async () => {
    try {
      const { used } = await api.apiPassStatus();
      set({ weeklyPassUsed: used });
    } catch {
      /* keep previous */
    }
  },

  gotoSummary: () => set({ view: "summary" }),
}));

/* helper hooks */
export const useActive = () => useAzm((s) => s.active);
export const useLang = () => useAzm((s) => s.lang);

export function techniquePreset(technique: "pomodoro" | "5217" | "custom", work: number, brk: number) {
  if (technique === "custom") return { work, break: brk };
  return TECHNIQUE_PRESETS[technique];
}
