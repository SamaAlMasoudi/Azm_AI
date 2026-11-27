/* Azm — active session view: synced with extension dashboard design */

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
const CARD = "rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22]";

export function ActiveSessionView() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const active = store.active;

  const currentUrl = store.browserHistory[store.browserIdx] ?? "youtube.com";
  const dest = useMemo(() => resolveDestination(currentUrl), [currentUrl]);

  if (!active) {
    return (
      <div className={`${CARD} flex flex-col items-center gap-4 p-12 text-center`}>
        <Orb state="idle" size={96} />
        <p className="text-lg text-[#A79BC8]">{d.dashboard.statementZero}</p>
        <button
          onClick={() => {
            store.resetDraft();
            store.setView("setup");
          }}
          className="inline-flex items-center gap-2 rounded-[14px] bg-[#7C3AED] px-6 py-3 text-sm font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-[#8B5CF6] transition-colors"
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
          <div
            className="relative flex items-center gap-3 rounded-[18px] border border-[#A79BC8]/34 p-4"
            style={{
              background:
                "radial-gradient(420px 180px at 100% 0%, rgba(124, 58, 237, 0.25), transparent 65%), linear-gradient(160deg, #1A1230, #130C22)",
            }}
          >
            <Orb state={orbState} size={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#F4F0FC]">{active.goal}</p>
              <p className="truncate text-[12.5px] text-[#A79BC8]">{active.task}</p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold ${
                orbState === "working"
                  ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-[#A78BFA]"
                  : orbState === "break"
                    ? "border-[#FBBF24]/40 bg-[#FBBF24]/12 text-[#FBBF24]"
                    : "border-[#34D399]/40 bg-[#34D399]/12 text-[#34D399]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  orbState === "break" ? "bg-[#FBBF24]" : "bg-[#34D399]"
                }`}
              />
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
          <div
            className={`${CARD} flex flex-col items-center gap-2 p-5 ${
              store.timerPhase === "break" ? "border-[#FBBF24]/40" : "border-[#A79BC8]/30"
            }`}
          >
            <TimerRing
              secondsLeft={store.secondsLeft}
              totalSeconds={store.timerPhase === "break" ? active.breakMinutes * 60 : workSec}
              phase={store.timerPhase}
              caption={phaseLabel}
              size={190}
            />
            <p className="tabular-nums text-[12.5px] text-[#A79BC8]">
              {d.session.roundOf} {active.rounds} · {d.session.elapsed}:{" "}
              {Math.floor(active.focusedSeconds / 60)} {d.dashboard.minutes}
            </p>
          </div>

          <div className={`${CARD} space-y-3 p-5`}>
            {/* smart-break budget */}
            <div className="flex items-center justify-between rounded-[12px] border border-[#FBBF24]/35 bg-[#FBBF24]/10 px-3 py-2.5 text-[12.5px]">
              <span className="flex items-center gap-1.5 font-bold text-[#FBBF24]">
                <BatteryMedium size={15} />
                {d.session.breakBudgetLine}
              </span>
              <span className="tabular-nums font-bold text-[#FBBF24]" dir="ltr">
                {Math.round(active.breakUsedSeconds / 60)}/{LEVELS[active.level].breakBudgetMin}{" "}
                {d.dialog.breakMinutes}
              </span>
            </div>

            <div className="rounded-[12px] border border-[#A79BC8]/16 bg-[#0A0612]/45 p-3">
              <div className="flex items-center gap-1.5 text-[12px] text-[#A79BC8]">
                <Flag size={13} className="text-[#A78BFA]" />
                <span>{d.session.outcomeLabel}</span>
              </div>
              <p className="mt-1 text-[13.5px] font-semibold leading-relaxed text-[#F4F0FC]">
                {active.expectedOutcome}
              </p>
            </div>

            <div className="rounded-[12px] border border-[#A79BC8]/16 bg-[#0A0612]/45 p-3">
              <div className="flex items-center gap-1.5 text-[12px] text-[#A79BC8]">
                <Target size={13} className="text-[#A78BFA]" />
                <span>{d.session.goalLabel}</span>
              </div>
              <p className="mt-1 text-[13.5px] font-semibold text-[#F4F0FC]">{active.goal}</p>
            </div>
          </div>

          <div className={`${CARD} p-5`}>
            <h3 className="mb-3 text-sm font-bold text-[#F4F0FC]">{d.session.actionsTitle}</h3>
            <div className="space-y-2">
              <button
                onClick={() => store.openDialog("break")}
                disabled={store.timerPhase === "break"}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#A79BC8]/34 bg-[#1A1230] px-4 py-2.5 text-sm font-bold text-[#A78BFA] hover:bg-[#241946] transition-colors disabled:opacity-45"
              >
                <Coffee size={16} />
                {d.session.actionBreak}
              </button>
              <button
                onClick={() => store.openDialog("end")}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#FB7185] px-4 py-2.5 text-sm font-bold text-[#1A0610] hover:bg-[#FDA4AF] transition-colors"
              >
                <LogOut size={16} />
                {d.session.actionEnd}
              </button>
              {store.timerPhase === "break" && store.breakKind === "agent" && (
                <button
                  onClick={() => store.endBreakEarly()}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#34D399]/50 bg-[#34D399]/16 px-4 py-2.5 text-[13.5px] font-bold text-[#34D399] hover:bg-[#34D399]/26 transition-colors"
                >
                  {d.session.endBreakEarlyBtn}
                </button>
              )}
            </div>
          </div>

          {/* temporary access grants */}
          <div className={`${CARD} p-5`}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#F4F0FC]">
              <KeyRound size={15} className="text-[#34D399]" />
              {d.grants.title}
            </h3>
            <p className="mb-3 text-[12px] text-[#A79BC8]">{d.grants.subtitle}</p>
            <div className="max-h-40 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
              {store.grants.length === 0 && (
                <p className="py-2 text-center text-[12.5px] text-[#A79BC8]">{d.grants.empty}</p>
              )}
              {store.grants.map((g) => {
                const leftMs = Math.max(0, g.expiresAt - Date.now());
                const leftMin = Math.ceil(leftMs / 60000);
                return (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 rounded-[12px] border border-[#34D399]/30 bg-[#34D399]/8 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[12.5px] font-semibold text-[#F4F0FC]" dir="ltr">
                      {g.domain}
                    </span>
                    <span
                      className="tabular-nums shrink-0 rounded-full border border-[#34D399]/40 bg-[#34D399]/14 px-2 py-0.5 text-[11px] font-bold text-[#34D399]"
                      dir="ltr"
                    >
                      {leftMin} {d.dashboard.minutes} {d.grants.left}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`${CARD} flex flex-col items-center p-5`}>
            <div className="mb-2 flex w-full items-center justify-between">
              <h3 className="text-sm font-bold text-[#F4F0FC]">{d.session.treeTitle}</h3>
              <span className="rounded-full border border-[#34D399]/40 bg-[#34D399]/12 px-2.5 py-0.5 text-[11.5px] font-bold text-[#34D399]">
                {d.session.treeStages[Math.min(5, Math.floor(active.focusedSeconds / (active.workMinutes * 60 / 6)))]}
              </span>
            </div>
            <SabrTree
              stage={Math.min(5, Math.floor(active.focusedSeconds / (active.workMinutes * 60 / 6)))}
              size={190}
            />
            <p className="text-[12px] text-[#A79BC8]">{d.session.treeSub}</p>
          </div>

          <div className={`${CARD} p-5`}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-[#F4F0FC]">
              <Timer size={15} className="text-[#A78BFA]" />
              {d.session.toolsTitle}
            </h3>
            <p className="mb-3 text-[12px] text-[#A79BC8]">{d.session.toolsSub}</p>
            <ToolRecommends compact />
          </div>
        </aside>
      </div>
    </div>
  );
}