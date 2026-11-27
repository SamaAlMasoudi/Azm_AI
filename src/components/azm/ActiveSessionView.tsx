/* Azm — active session view: timer, task, actions, Sabr tree, temporary grants,
 * smart-break budget, tools + simulated browser */

"use client";

import { useMemo } from "react";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { LEVELS } from "@/lib/azm/policy";
import { resolveDestination } from "@/lib/azm/urls";
import type { OrbState } from "@/lib/azm/types";
import { TimerRing } from "./TimerRing";
import { Orb } from "./Orb";
import { SabrTree } from "./SabrTree";
import { BrowserFrame } from "./BrowserFrame";
import { InterceptionOverlay } from "./InterceptionOverlay";
import { ToolRecommends } from "./ToolRecommends";
import { Coffee, LogOut, Plus, Target, Flag, Timer, KeyRound, BatteryMedium } from "lucide-react";

const USEFUL_CATEGORIES = ["education", "reference", "ai_tool", "search"];

export function ActiveSessionView() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const active = store.active;

  // the 1-second session heartbeat lives in AzmApp so the timer keeps
  // running on every tab; this view just renders the store state

  const currentUrl = store.browserHistory[store.browserIdx] ?? "youtube.com";
  const dest = useMemo(() => resolveDestination(currentUrl), [currentUrl]);

  if (!active) {
    return (
      <div className="azm-card flex flex-col items-center gap-4 p-12 text-center">
        <Orb state="idle" size={96} />
        <p className="text-lg text-azm-muted">{d.dashboard.statementZero}</p>
        <button
          onClick={() => {
            store.resetDraft();
            store.setView("setup");
          }}
          className="azm-btn flex items-center gap-2 bg-[#7C3AED] px-6 py-3 text-sm font-bold text-white hover:bg-[#8B5CF6] transition-colors azm-glow"
        >
          <Plus size={16} />
          {d.dashboard.newSessionCta}
        </button>
      </div>
    );
  }

  const orbState: OrbState = store.interception
    ? "alert"
    : store.timerPhase === "break"
      ? "break"
      : USEFUL_CATEGORIES.includes(dest.category)
        ? "working"
        : "focused";

  const phaseLabel =
    store.timerPhase === "break"
      ? d.session.phaseBreak
      : d.session.phaseWork;
  const workSec = active.workMinutes * 60;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        {/* browser */}
        <div className="min-w-0 space-y-4">
          <div className="azm-card relative flex items-center gap-3 p-4">
            <Orb state={orbState} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-azm-ink">{active.goal}</p>
              <p className="truncate text-[12px] text-azm-muted">{active.task}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                orbState === "working"
                  ? "border-azm-primary/40 bg-azm-primary/10 text-azm-soft"
                  : orbState === "break"
                    ? "border-azm-info/40 bg-azm-info/10 text-azm-info"
                    : "border-azm-ok/40 bg-azm-ok/10 text-azm-ok"
              }`}
            >
              {d.orb[orbState]}
            </span>
          </div>

          <div className="relative">
            <BrowserFrame />
            <InterceptionOverlay />
          </div>
        </div>

        {/* side rail */}
        <aside className="space-y-4">
          <div className={`azm-card flex flex-col items-center gap-2 p-5 ${store.timerPhase === "break" ? "azm-glow-info" : ""}`}>
            <TimerRing
              secondsLeft={store.secondsLeft}
              totalSeconds={store.timerPhase === "break" ? active.breakMinutes * 60 : workSec}
              phase={store.timerPhase}
              caption={phaseLabel}
              size={190}
            />
            <p className="azm-nums text-[12px] text-azm-muted">
              {d.session.roundOf} {active.rounds} · {d.session.elapsed}: {Math.floor(active.focusedSeconds / 60)} {d.dashboard.minutes}
            </p>
          </div>

          <div className="azm-card space-y-3 p-5">
            {/* smart-break budget */}
            <div className="flex items-center justify-between rounded-xl border border-azm-info/25 bg-azm-info/10 px-3 py-2.5 text-[12px]">
              <span className="flex items-center gap-1.5 font-semibold text-azm-info">
                <BatteryMedium size={14} />
                {d.session.breakBudgetLine}
              </span>
              <span className="azm-nums font-bold text-azm-info" dir="ltr">
                {Math.round(active.breakUsedSeconds / 60)}/{LEVELS[active.level].breakBudgetMin} {d.dialog.breakMinutes}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <Flag size={15} className="mt-1 shrink-0 text-azm-soft" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-azm-muted">{d.session.outcomeLabel}</p>
                <p className="text-[13px] leading-relaxed text-azm-ink">{active.expectedOutcome}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Target size={15} className="mt-1 shrink-0 text-azm-soft" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-azm-muted">{d.session.goalLabel}</p>
                <p className="text-[13px] text-azm-ink">{active.goal}</p>
              </div>
            </div>
          </div>

          <div className="azm-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-azm-soft">{d.session.actionsTitle}</h3>
            <div className="space-y-2">
              <button
                onClick={() => store.openDialog("break")}
                disabled={store.timerPhase === "break"}
                className="azm-btn flex w-full items-center justify-center gap-2 border border-azm-info/40 bg-azm-info/35 px-4 py-3 text-sm font-bold text-[#bfdbfe] hover:bg-azm-info/45 transition-colors disabled:opacity-40"
              >
                <Coffee size={16} />
                {d.session.actionBreak}
              </button>
              <button
                onClick={() => store.openDialog("end")}
                className="azm-btn flex w-full items-center justify-center gap-2 border border-azm-bad/40 bg-azm-bad/35 px-4 py-3 text-sm font-bold text-[#fecdd3] hover:bg-azm-bad/45 transition-colors"
              >
                <LogOut size={16} />
                {d.session.actionEnd}
              </button>
              {store.timerPhase === "break" && store.breakKind === "agent" && (
                <button
                  onClick={() => store.endBreakEarly()}
                  className="azm-btn flex w-full items-center justify-center gap-2 border border-azm-ok/40 bg-azm-ok/10 px-4 py-3 text-[13px] font-bold text-azm-ok hover:bg-azm-ok/20 transition-colors"
                >
                  {d.session.endBreakEarlyBtn}
                </button>
              )}
            </div>
          </div>

          {/* temporary access grants */}
          <div className="azm-card p-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-azm-soft">
              <KeyRound size={14} className="text-azm-ok" />
              {d.grants.title}
            </h3>
            <p className="mb-3 text-[11px] text-azm-muted">{d.grants.subtitle}</p>
            <div className="max-h-40 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
              {store.grants.length === 0 && <p className="py-2 text-center text-[12px] text-azm-muted">{d.grants.empty}</p>}
              {store.grants.map((g) => {
                const leftMs = Math.max(0, g.expiresAt - Date.now());
                const leftMin = Math.ceil(leftMs / 60000);
                return (
                  <div key={g.id} className="flex items-center justify-between gap-2 rounded-xl border border-azm-ok/25 bg-azm-ok/5 px-3 py-2">
                    <span className="min-w-0 truncate text-[12px] font-semibold text-azm-ink" dir="ltr">
                      {g.domain}
                    </span>
                    <span className="azm-nums shrink-0 rounded-full border border-azm-ok/40 bg-azm-ok/10 px-2 py-0.5 text-[10px] font-bold text-azm-ok" dir="ltr">
                      {leftMin} {d.dashboard.minutes} {d.grants.left}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="azm-card flex flex-col items-center p-5">
            <div className="mb-2 flex w-full items-center justify-between">
              <h3 className="text-sm font-semibold text-azm-soft">{d.session.treeTitle}</h3>
              <span className="rounded-full border border-azm-ok/40 bg-azm-ok/10 px-2.5 py-0.5 text-[11px] font-semibold text-azm-ok">
                {d.session.treeStages[Math.min(5, Math.floor(active.focusedSeconds / (active.workMinutes * 60 / 6)))]}
              </span>
            </div>
            <SabrTree stage={Math.min(5, Math.floor(active.focusedSeconds / (active.workMinutes * 60 / 6)))} size={190} />
            <p className="text-[11px] text-azm-muted">{d.session.treeSub}</p>
          </div>

          <div className="azm-card p-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-azm-soft">
              <Timer size={14} className="text-azm-primary" />
              {d.session.toolsTitle}
            </h3>
            <p className="mb-3 text-[11px] text-azm-muted">{d.session.toolsSub}</p>
            <ToolRecommends compact />
          </div>
        </aside>
      </div>

    </div>
  );
}
