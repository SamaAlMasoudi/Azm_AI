/* Azm — settings: language, personality, agent intervention levels, AI
 * customization, AI memory, workspace isolation, Chrome-extension pairing,
 * privacy & data control. */

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { LEVELS, type InterventionLevel } from "@/lib/azm/policy";
import { PROVIDER_ORDER, PROVIDERS, type ProviderId } from "@/lib/azm/server/providers";
import { AZM } from "@/lib/azm/tokens";
import type { Personality } from "@/lib/azm/types";
import * as api from "@/lib/azm/api";
import {
  Languages, VenetianMask, UserRound, Lightbulb, ShieldCheck, Database, FlaskConical, Info, Trash2,
  Gauge, Cpu, BrainCircuit, KeyRound, Fingerprint, Puzzle, Copy, RefreshCw, Download, Eye, EyeOff, Wifi, WifiOff,
  Timer, ListChecks, Server, CloudOff, Zap, Lock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/5 pb-5 last:border-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-azm-ink">{title}</h3>
        {hint && <p className="mt-1 text-[12px] leading-relaxed text-azm-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const LEVEL_META: { id: InterventionLevel; nameKey: "passive" | "gentle" | "balanced" | "strict"; descKey: "passiveDesc" | "gentleDesc" | "balancedDesc" | "strictDesc"; icon: React.ReactNode }[] = [
  { id: "passive", nameKey: "passive", descKey: "passiveDesc", icon: <Eye size={15} /> },
  { id: "gentle", nameKey: "gentle", descKey: "gentleDesc", icon: <Info size={15} /> },
  { id: "balanced", nameKey: "balanced", descKey: "balancedDesc", icon: <Gauge size={15} /> },
  { id: "strict", nameKey: "strict", descKey: "strictDesc", icon: <ShieldCheck size={15} /> },
];

export function SettingsView() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const [resetOpen, setResetOpen] = useState(false);

  // AI customization local form state
  const [aiProvider, setAiProvider] = useState<ProviderId>("builtin");
  const [aiModel, setAiModel] = useState("");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; ms?: number; error?: string } | null>(null);
  const [liveModels, setLiveModels] = useState<Array<{ id: string; tier?: string }> | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  // intervention window slider (committed on release to avoid request storms)
  const [windowSec, setWindowSec] = useState<number | null>(null);

  // memory form
  const [memoryText, setMemoryText] = useState("");

  // profile import
  const [importCode, setImportCode] = useState("");

  const profileCode = store.profile?.code ?? "";

  // load memory + poll extension connection status
  useEffect(() => {
    void store.loadMemory();
    const t = setInterval(() => {
      api
        .apiGetProfile()
        .then(({ profile }) => {
          const cur = useAzm.getState().profile;
          if (cur) useAzm.setState({ profile: { ...cur, extConnected: profile.extConnected, extLastSeen: profile.extLastSeen } });
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
     
  }, [profileCode]);

  // sync AI form state from the profile (adjust-during-render pattern)
  const [formProfileCode, setFormProfileCode] = useState<string | null>(null);
  if (store.profile && formProfileCode !== profileCode) {
    setFormProfileCode(profileCode);
    setAiProvider((store.profile.ai.provider as ProviderId) ?? "builtin");
    setAiModel(store.profile.ai.model);
    setAiBaseUrl(store.profile.ai.baseUrl);
    setWindowSec(store.profile.ai.challengeSeconds ?? 30);
  }

  const meta = PROVIDERS[aiProvider];
  const storedKeys = store.profile?.ai.keys ?? {};

  const pickProvider = (id: ProviderId) => {
    setAiProvider(id);
    setAiModel(PROVIDERS[id].defaultModel);
    setAiBaseUrl(PROVIDERS[id].supportsBaseUrl ? (store.profile?.ai.baseUrl || PROVIDERS[id].defaultBaseUrl) : "");
    setAiApiKey("");
    setTestResult(null);
    setLiveModels(null);
  };

  const fetchModels = async () => {
    if (aiProvider === "builtin" || aiProvider === "off") return;
    if (meta.requiresKey && !aiApiKey && !storedKeys[aiProvider]?.hasKey) {
      toast.error(d.aiSettings.keyNeededFirst);
      return;
    }
    setFetchingModels(true);
    try {
      const r = await api.apiListModels(aiProvider);
      if (r.live && r.models.length) {
        setLiveModels(r.models);
        toast.success(`${d.aiSettings.modelsFetched} (${r.models.length})`);
      } else {
        toast.error(r.error === "key-missing" ? d.aiSettings.keyNeededFirst : r.error || d.aiSettings.modelsFetchFail);
      }
    } catch {
      toast.error(d.aiSettings.modelsFetchFail);
    } finally {
      setFetchingModels(false);
    }
  };

  const personalities: { id: Personality; name: string; icon: React.ReactNode }[] = [
    { id: "strict", name: d.setup.strict, icon: <VenetianMask size={15} /> },
    { id: "friend", name: d.setup.friend, icon: <UserRound size={15} /> },
    { id: "philosopher", name: d.setup.philosopher, icon: <Lightbulb size={15} /> },
  ];

  const copyValue = async (value: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(okMsg);
    } catch {
      toast.error(d.toasts.networkError);
    }
  };

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-5 azm-rise">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-azm-ink">{d.settings.title}</h1>
      </header>

      {/* language + personality */}
      <section className="azm-card p-5 md:p-6">
        <Row title={d.settings.languageLabel} hint={d.settings.languageHint}>
          <div className="flex overflow-hidden rounded-xl border border-white/10">
            <button
              onClick={() => store.setLang("ar")}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                lang === "ar" ? "bg-[#7C3AED] text-white" : "bg-white/5 text-azm-muted hover:text-azm-ink"
              }`}
            >
              العربية
            </button>
            <button
              onClick={() => store.setLang("en")}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
                lang === "en" ? "bg-[#7C3AED] text-white" : "bg-white/5 text-azm-muted hover:text-azm-ink"
              }`}
              dir="ltr"
            >
              English
            </button>
          </div>
        </Row>
        <Row title={d.settings.personalityLabel} hint={d.settings.personalityHint}>
          <div className="flex flex-wrap gap-2">
            {personalities.map((p) => (
              <button
                key={p.id}
                onClick={() => store.setDefaultPersonality(p.id)}
                className={`azm-btn flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  store.defaultPersonality === p.id
                    ? "bg-[#7C3AED] text-white"
                    : "border border-white/10 bg-white/5 text-azm-muted hover:text-azm-ink"
                }`}
              >
                {p.icon}
                {p.name}
              </button>
            ))}
          </div>
        </Row>
      </section>

      {/* agent intervention level */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <Gauge size={18} className="text-azm-primary" />
          {d.levels.title}
        </h2>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-azm-muted">{d.levels.subtitle}</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {LEVEL_META.map((lv) => {
            const selected = (store.profile?.interventionLevel ?? "balanced") === lv.id;
            return (
              <button
                key={lv.id}
                onClick={() => void store.setInterventionLevel(lv.id)}
                className={`azm-btn flex flex-col items-start gap-1 rounded-2xl border p-4 text-start transition-colors ${
                  selected
                    ? "border-azm-primary bg-azm-primary/15"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
                aria-pressed={selected}
              >
                <span className={`flex items-center gap-2 text-sm font-bold ${selected ? "text-azm-soft" : "text-azm-ink"}`}>
                  {lv.icon}
                  {d.levels[lv.nameKey]}
                  {selected && <span className="rounded-full bg-azm-primary px-2 py-0.5 text-[10px] text-white">✓</span>}
                </span>
                <span className="text-[12px] leading-relaxed text-azm-muted">{d.levels[lv.descKey]}</span>
                <span className="azm-nums text-[10px] text-azm-muted/70" dir="ltr">
                  {LEVELS[lv.id].timerSec}s · {LEVELS[lv.id].maxRounds}r · {LEVELS[lv.id].breakBudgetMin}min
                </span>
              </button>
            );
          })}
        </div>

        {/* configurable human-intervention window */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Timer size={16} className="text-azm-primary" />
              <h3 className="text-sm font-semibold text-azm-ink">{d.levels.windowTitle}</h3>
            </div>
            <span className="azm-nums rounded-full border border-azm-primary/40 bg-azm-primary/10 px-3 py-1 text-[12px] font-bold text-azm-soft" dir="ltr">
              {windowSec ?? 30}s
            </span>
          </div>
          <p className="mb-3 mt-2 text-[12px] leading-relaxed text-azm-muted">{d.levels.windowHint}</p>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={windowSec ?? 30}
            onChange={(e) => setWindowSec(Number(e.target.value))}
            onMouseUp={() => void store.setChallengeSeconds(windowSec ?? 30)}
            onTouchEnd={() => void store.setChallengeSeconds(windowSec ?? 30)}
            onKeyUp={() => void store.setChallengeSeconds(windowSec ?? 30)}
            className="w-full accent-[#7C3AED]"
            aria-label={d.levels.windowTitle}
            dir="ltr"
          />
          <div className="mt-1 flex justify-between text-[10px] text-azm-muted/70" dir="ltr">
            <span>10s</span>
            <span>30s</span>
            <span>60s</span>
            <span>120s</span>
          </div>
        </div>
      </section>

      {/* AI customization */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <Cpu size={18} className="text-azm-primary" />
          {d.aiSettings.title}
        </h2>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-azm-muted">{d.aiSettings.subtitle}</p>

        {/* provider cards — with honest cost badges */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={d.aiSettings.providerLabel}>
          {PROVIDER_ORDER.map((pid) => {
            const pm = PROVIDERS[pid];
            const selected = aiProvider === pid;
            const tierStyle =
              pm.tier === "included"
                ? { border: "rgba(52,211,153,0.4)", bg: "rgba(52,211,153,0.08)", color: AZM.ok, icon: <Zap size={11} /> }
                : pm.tier === "free_tier"
                  ? { border: "rgba(251,191,36,0.4)", bg: "rgba(251,191,36,0.08)", color: AZM.warn, icon: <Zap size={11} /> }
                  : pm.tier === "local"
                    ? { border: "rgba(167,139,250,0.4)", bg: "rgba(167,139,250,0.08)", color: AZM.primary, icon: <Server size={11} /> }
                    : pm.tier === "paid"
                      ? { border: "rgba(255,255,255,0.15)", bg: "rgba(255,255,255,0.05)", color: AZM.muted, icon: <CloudOff size={11} /> }
                      : { border: "rgba(255,255,255,0.15)", bg: "rgba(255,255,255,0.05)", color: AZM.muted, icon: <CloudOff size={11} /> };
            return (
              <button
                key={pid}
                role="radio"
                aria-checked={selected}
                onClick={() => pickProvider(pid)}
                className={`azm-btn flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-start transition-colors ${
                  selected ? "border-azm-primary bg-azm-primary/15" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${selected ? "text-azm-soft" : "text-azm-ink"}`}>{d.aiSettings[pid]}</span>
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                    style={{ borderColor: tierStyle.border, background: tierStyle.bg, color: tierStyle.color }}
                    title={d.aiSettings[`tier_${pm.tier}` as "tier_included" | "tier_free_tier" | "tier_local" | "tier_paid" | "tier_none"]}
                  >
                    {tierStyle.icon}
                    {d.aiSettings[`tier_${pm.tier}` as "tier_included" | "tier_free_tier" | "tier_local" | "tier_paid" | "tier_none"]}
                  </span>
                </span>
                <span className="text-[11px] leading-relaxed text-azm-muted">{pm.hint}</span>
                {storedKeys[pid]?.hasKey && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-azm-ok" dir="ltr">
                    <KeyRound size={10} />
                    {storedKeys[pid]!.keyPreview}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(aiProvider !== "builtin" && aiProvider !== "off") && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {/* model: editable + curated/live suggestions */}
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-azm-soft">
              <span className="flex items-center justify-between gap-2">
                {d.aiSettings.modelLabel}
                <button
                  type="button"
                  onClick={() => void fetchModels()}
                  disabled={fetchingModels}
                  className="azm-btn flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-azm-soft transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  <ListChecks size={11} />
                  {fetchingModels ? d.aiSettings.fetchingModels : d.aiSettings.fetchModels}
                </button>
              </span>
              <input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder={meta.defaultModel}
                dir="ltr"
                list="azm-model-options"
                className="azm-field border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary"
              />
              <datalist id="azm-model-options">
                {(liveModels ?? meta.models).map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
              {liveModels ? (
                <span className="text-[10px] font-normal text-azm-ok">
                  {d.aiSettings.liveList} · {liveModels.length}
                </span>
              ) : (
                <span className="text-[10px] font-normal text-azm-muted">
                  {d.aiSettings.curatedList}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-azm-soft">
              {d.aiSettings.baseUrlLabel}
              <input
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder={meta.defaultBaseUrl}
                disabled={!meta.supportsBaseUrl}
                dir="ltr"
                className="azm-field border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary disabled:opacity-50"
              />
              {aiProvider === "ollama" && (
                <span className="text-[10px] font-normal leading-relaxed text-azm-muted">
                  {d.aiSettings.ollamaReachHint}
                </span>
              )}
            </label>
            {meta.requiresKey && (
              <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-azm-soft md:col-span-2">
                {d.aiSettings.apiKeyLabel}
                {storedKeys[aiProvider]?.hasKey && (
                  <span className="flex items-center gap-2 text-[11px] font-normal text-azm-ok">
                    <KeyRound size={12} />
                    {d.aiSettings.keyStored} ({storedKeys[aiProvider]!.keyPreview})
                  </span>
                )}
                <span className="relative flex">
                  <input
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={aiProvider === "groq" ? "gsk_…" : "sk-…"}
                    type={showKey ? "text" : "password"}
                    dir="ltr"
                    className="azm-field w-full border border-white/10 bg-white/5 px-3 py-2.5 pe-10 text-[13px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-azm-muted hover:text-azm-ink"
                    aria-label={showKey ? d.aiSettings.hideKey : d.aiSettings.showKey}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-normal text-azm-muted">
                  <Lock size={10} />
                  {d.aiSettings.keyServerOnly}
                </span>
              </label>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              await store.updateAi({
                aiProvider,
                aiModel: aiProvider === "builtin" || aiProvider === "off" ? "" : aiModel,
                aiBaseUrl: meta.supportsBaseUrl ? aiBaseUrl : "",
                ...(aiApiKey.trim() ? { aiApiKey: aiApiKey.trim() } : {}),
              });
              setAiApiKey("");
              toast.success(d.aiSettings.saved);
            }}
            className="azm-btn bg-[#7C3AED] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#8B5CF6] transition-colors"
          >
            {d.aiSettings.save}
          </button>
          <button
            onClick={async () => {
              setTesting(true);
              setTestResult(null);
              const r = await store.testAi({
                aiProvider,
                aiModel: aiProvider === "builtin" || aiProvider === "off" ? undefined : aiModel,
                aiBaseUrl: meta.supportsBaseUrl ? aiBaseUrl : undefined,
                aiApiKey: aiApiKey.trim() || undefined,
              });
              setTestResult(r);
              setTesting(false);
            }}
            disabled={testing}
            className="azm-btn border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            {testing ? d.aiSettings.testing : d.aiSettings.test}
          </button>
          {testResult && (
            <span className={`text-[12px] font-semibold ${testResult.ok ? "text-azm-ok" : "text-azm-bad"}`} dir="ltr" role="status" aria-live="polite">
              {testResult.ok
                ? `${d.aiSettings.testOk}${testResult.ms ? ` (${testResult.ms}ms)` : ""}`
                : `${d.aiSettings.testFail}: ${testResult.error ?? ""}`}
            </span>
          )}
        </div>
      </section>

      {/* AI memory */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <BrainCircuit size={18} className="text-azm-primary" />
          {d.memoryMgr.title}
          <span className="azm-nums rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-azm-muted">
            {store.memory.length}
          </span>
        </h2>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-azm-muted">{d.memoryMgr.subtitle}</p>

        <div className="flex gap-2">
          <input
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && memoryText.trim()) {
                void store.addMemory(memoryText.trim());
                setMemoryText("");
              }
            }}
            placeholder={d.memoryMgr.placeholder}
            className="azm-field flex-1 border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary"
            aria-label={d.memoryMgr.placeholder}
          />
          <button
            onClick={() => {
              if (!memoryText.trim()) return;
              void store.addMemory(memoryText.trim());
              setMemoryText("");
            }}
            disabled={!memoryText.trim()}
            className="azm-btn bg-[#7C3AED] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#8B5CF6] transition-colors disabled:opacity-40"
          >
            {d.memoryMgr.add}
          </button>
        </div>

        <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
          {store.memory.length === 0 && <p className="py-3 text-center text-[12px] text-azm-muted">{d.memoryMgr.empty}</p>}
          {store.memory.map((m) => (
            <div key={m.id} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-3">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  m.source === "agent" ? "border border-azm-primary/40 bg-azm-primary/10 text-azm-soft" : "border border-azm-ok/40 bg-azm-ok/10 text-azm-ok"
                }`}
              >
                {m.source === "agent" ? d.memoryMgr.agentTag : d.memoryMgr.userTag}
              </span>
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-azm-ink">{m.text}</p>
              <button
                onClick={() => void store.deleteMemory(m.id)}
                className="shrink-0 rounded-lg p-1.5 text-azm-muted hover:bg-white/10 hover:text-azm-bad transition-colors"
                aria-label={d.common.delete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* workspace isolation */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <Fingerprint size={18} className="text-azm-primary" />
          {d.profileIso.title}
        </h2>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-azm-muted">{d.profileIso.subtitle}</p>

        <Row title={d.profileIso.codeLabel} hint={d.profileIso.warning}>
          <div className="flex items-center gap-2">
            <code className="azm-nums rounded-xl border border-azm-primary/40 bg-azm-primary/10 px-4 py-2.5 text-lg font-bold tracking-[0.3em] text-azm-soft" dir="ltr">
              {store.profile?.code ?? "········"}
            </code>
            <button
              onClick={() => void copyValue(store.profile?.code ?? "", d.profileIso.copyCode)}
              className="azm-btn border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-azm-soft hover:bg-white/10 transition-colors"
              aria-label={d.profileIso.copyCode}
            >
              <Copy size={14} />
            </button>
          </div>
        </Row>

        {!store.profile && store.profileError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-azm-bad/40 bg-azm-bad/10 px-3 py-2.5 text-[12px] text-azm-bad">
            <span className="min-w-0 flex-1" dir="ltr">
              {d.profileIso.loadFailed} {store.profileError}
            </span>
            <button
              onClick={() => void store.loadProfile()}
              className="azm-btn flex items-center gap-1.5 border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-azm-soft hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={12} />
              {d.profileIso.retry}
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row">
          <input
            value={importCode}
            onChange={(e) => setImportCode(e.target.value.toUpperCase())}
            placeholder={d.profileIso.importPlaceholder}
            maxLength={10}
            dir="ltr"
            className="azm-field flex-1 border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] tracking-[0.2em] text-azm-ink placeholder:tracking-normal placeholder:text-azm-muted/60 outline-none focus:border-azm-primary"
            aria-label={d.profileIso.importLabel}
          />
          <button
            onClick={async () => {
              const ok = await store.importProfile(importCode);
              if (ok) setImportCode("");
            }}
            disabled={!importCode.trim()}
            className="azm-btn border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            {d.profileIso.importBtn}
          </button>
        </div>
      </section>

      {/* Chrome extension pairing */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <Puzzle size={18} className="text-azm-primary" />
          {d.pairing.title}
        </h2>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-azm-muted">{d.pairing.subtitle}</p>

        <div className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold" style={{ borderColor: store.profile?.extConnected ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)", background: store.profile?.extConnected ? "rgba(52,211,153,0.08)" : "rgba(255,255,255,0.05)" }}>
          {store.profile?.extConnected ? <Wifi size={15} className="text-azm-ok" /> : <WifiOff size={15} className="text-azm-muted" />}
          <span className={store.profile?.extConnected ? "text-azm-ok" : "text-azm-muted"}>{store.profile?.extConnected ? d.pairing.connected : d.pairing.disconnected}</span>
        </div>

        <Row title={d.pairing.tokenLabel} hint={`${d.pairing.serverUrlLabel}: ${serverUrl}`}>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] font-bold text-azm-soft" dir="ltr">
              {store.profile ? `${store.profile.pairingToken.slice(0, 10)}…${store.profile.pairingToken.slice(-6)}` : "··········…······"}
            </code>
            <button
              onClick={() => void copyValue(store.profile?.pairingToken ?? "", d.pairing.copied)}
              className="azm-btn border border-white/15 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-azm-soft hover:bg-white/10 transition-colors"
              aria-label={d.pairing.copy}
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => void store.regeneratePairing()}
              className="azm-btn flex items-center gap-1.5 border border-azm-warn/40 bg-azm-warn/10 px-3 py-2.5 text-[12px] font-semibold text-azm-warn hover:bg-azm-warn/20 transition-colors"
            >
              <RefreshCw size={13} />
              {d.pairing.regenerate}
            </button>
            <a
              href="/azm-extension.zip"
              download
              className="azm-btn flex items-center gap-1.5 bg-[#7C3AED] px-3.5 py-2.5 text-[12px] font-bold text-white hover:bg-[#8B5CF6] transition-colors"
            >
              <Download size={13} />
              {d.pairing.download}
            </a>
          </div>
        </Row>

        <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] leading-relaxed text-azm-muted">
          {d.pairing.steps}
        </p>
        <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-azm-muted">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-azm-ok" />
          {d.pairing.privacy}
        </p>
      </section>

      {/* privacy & permissions */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <ShieldCheck size={18} className="text-azm-ok" />
          {d.settings.privacyTitle}
        </h2>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-azm-muted">{d.settings.privacyIntro}</p>
        <h3 className="mb-3 text-[13px] font-semibold text-azm-soft">{d.settings.permissionsTitle}</h3>
        <ul className="space-y-2.5">
          {[d.settings.permTabs, d.settings.permStorage, d.settings.permAlarms, d.settings.permHosts].map(
            (perm) => (
              <li key={perm} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-azm-ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-azm-primary" />
                {perm}
              </li>
            )
          )}
        </ul>
      </section>

      {/* data control */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <Database size={18} className="text-azm-primary" />
          {d.settings.dataTitle}
        </h2>
        <p className="mb-4 mt-2 text-[13px] text-azm-muted">{d.settings.dataDesc}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={async () => {
              try {
                await api.apiSeedDemo();
                toast.success(d.toasts.demoDone);
              } catch {
                toast.error(d.toasts.networkError);
              }
            }}
            className="azm-btn flex items-center gap-2 border border-azm-primary/40 bg-azm-primary/10 px-4 py-2.5 text-sm font-semibold text-azm-soft hover:bg-azm-primary/20 transition-colors"
          >
            <FlaskConical size={15} />
            {d.settings.demoBtn}
          </button>
          <button
            onClick={() => setResetOpen(true)}
            className="azm-btn flex items-center gap-2 border border-azm-bad/40 bg-azm-bad/10 px-4 py-2.5 text-sm font-semibold text-azm-bad hover:bg-azm-bad/20 transition-colors"
          >
            <Trash2 size={15} />
            {d.settings.resetBtn}
          </button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-azm-muted">
          <Info size={13} className="mt-0.5 shrink-0" />
          {d.settings.demoNote}
        </p>
      </section>

      {/* about */}
      <section className="azm-card p-5 md:p-6">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-azm-ink">
          <Info size={18} className="text-azm-primary" />
          {d.settings.aboutTitle}
        </h2>
        <p className="text-[13px] leading-loose text-azm-muted">{d.settings.aboutBody}</p>
        <p className="mt-3 text-[12px] text-azm-muted/70">{d.settings.version}</p>
      </section>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="border-white/10 bg-[#120A1F] text-azm-ink" dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{d.settings.resetConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-azm-muted">
              {d.settings.resetConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/5 text-azm-soft hover:bg-white/10">
              {d.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-azm-bad text-white hover:bg-azm-bad/80"
              onClick={async () => {
                try {
                  await api.apiResetAll();
                  await store.resetProfileData();
                  toast.success(d.toasts.resetDone);
                  store.resetDraft();
                  await store.loadGroups();
                  store.setView("dashboard");
                } catch {
                  toast.error(d.toasts.networkError);
                }
              }}
            >
              {d.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

