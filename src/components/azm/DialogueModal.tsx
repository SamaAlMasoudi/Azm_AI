/* Azm — dialogue modal: smart-break conversation, end-session dialogue,
 * achievement verification. Break requests run through the agent as a
 * multi-round conversation with a level-based budget. */

"use client";

import { useEffect, useRef, useState } from "react";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { LEVELS } from "@/lib/azm/policy";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Coffee, LogOut, Ticket, Loader2, Send, CheckCircle2, Sparkles, BatteryMedium } from "lucide-react";

export function DialogueModal() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const dialog = store.dialog;
  const active = store.active;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [budgetNow, setBudgetNow] = useState(0);

  // live budget (focused seconds grow while the dialog is open)
  useEffect(() => {
    if (!dialog || dialog.kind !== "break" || !active) return;
    const t = setInterval(() => setBudgetNow(Math.floor(active.focusedSeconds)), 1000);
    return () => clearInterval(t);
  }, [dialog?.kind, active?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [dialog?.lines.length, dialog?.stage]);

  if (!dialog || !active) return null;

  const isBreak = dialog.kind === "break";
  const isEnd = dialog.kind === "end";
  const isVerify = dialog.kind === "verify";

  const title = isBreak ? d.dialog.breakTitle : isEnd ? d.dialog.endTitle : d.dialog.verifyTitle;
  const intro = isBreak
    ? d.dialog.breakIntro
    : isEnd
      ? d.dialog.endIntro
      : d.dialog.verifyIntro;
  const placeholder = isBreak
    ? d.dialog.breakPlaceholder
    : isEnd
      ? d.dialog.endPlaceholder
      : d.dialog.verifyPlaceholder;

  const decision = dialog.result;
  const endAction = dialog.kind === "end" && decision ? (decision as { action: string }) : null;
  const breakDecision =
    dialog.kind === "break" && decision && "status" in decision
      ? (decision as { status: string; minutes?: number })
      : null;

  const thinking = dialog.stage === "thinking";
  const lv = LEVELS[active.level];
  const focusedMin = Math.floor((dialog.kind === "break" ? budgetNow || active.focusedSeconds : active.focusedSeconds) / 60);
  const usedMin = Math.round(active.breakUsedSeconds / 60);
  const budgetLeft = Math.max(0, lv.breakBudgetMin - usedMin);
  const canEarnBreak = focusedMin >= lv.minStudyBeforeBreakMin && budgetLeft > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && !thinking && store.closeDialog()}>
      <DialogContent className="azm-card max-w-lg border-white/10 bg-[#120A1F] text-azm-ink gap-0" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            {isBreak && <Coffee size={19} className="text-azm-info" />}
            {isEnd && <LogOut size={19} className="text-azm-bad" />}
            {isVerify && <CheckCircle2 size={19} className="text-azm-ok" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-azm-muted">
            {intro}
          </DialogDescription>
        </DialogHeader>

        {/* smart-break budget line */}
        {isBreak && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-azm-info/25 bg-azm-info/10 px-4 py-2.5 text-[12px]">
            <BatteryMedium size={15} className="text-azm-info" />
            <span className="text-azm-soft">{d.session.breakBudgetLine}:</span>
            <span className="azm-nums font-bold text-azm-info">
              {usedMin}/{lv.breakBudgetMin} {d.dialog.breakMinutes}
            </span>
            <span className="text-azm-muted">
              ({focusedMin >= lv.minStudyBeforeBreakMin ? d.dialog.breakEarnable : d.dialog.breakNeedStudy.replace("{min}", String(lv.minStudyBeforeBreakMin))})
            </span>
          </div>
        )}

        {/* break conversation */}
        {isBreak && dialog.lines.length > 0 && (
          <div ref={scrollRef} className="mb-3 max-h-44 space-y-2.5 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            {dialog.lines.map((line, idx) => (
              <div key={idx} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    line.role === "user" ? "bg-azm-primary/20 text-azm-ink" : "border border-white/10 bg-[#120A1F] text-azm-ink"
                  }`}
                >
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {dialog.stage === "input" && (
          <div>
            <textarea
              value={dialog.text}
              onChange={(e) => store.setDialogText(e.target.value)}
              placeholder={placeholder}
              className="azm-field min-h-[96px] w-full resize-none border border-white/10 bg-white/5 p-3.5 text-[14px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary focus:ring-2 focus:ring-azm-primary/30"
              autoFocus
              aria-label={placeholder}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={store.closeDialog}
                className="azm-btn border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors"
              >
                {d.common.cancel}
              </button>
              <button
                onClick={() => {
                  if (isBreak) void store.sendBreakRequest();
                  else if (isEnd) void store.sendEndReason();
                  else void store.sendVerification();
                }}
                disabled={!dialog.text.trim()}
                className="azm-btn flex items-center gap-2 bg-[#7C3AED] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#8B5CF6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                {isVerify ? d.dialog.verifySubmit : isBreak ? d.dialog.breakSubmit : d.dialog.endSubmit}
              </button>
            </div>
          </div>
        )}

        {thinking && (
          <div className="flex items-center gap-3 py-6">
            <Loader2 size={22} className="animate-spin text-azm-primary" />
            <span className="text-[15px] text-azm-ink azm-breathe">{d.common.aiThinking}</span>
          </div>
        )}

        {dialog.stage === "result" && decision && (
          <div className="azm-rise">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-azm-primary">
                <Sparkles size={13} />
                AZM AI
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-azm-muted border border-white/10">
                  {(decision as { source?: string }).source === "ai" ? d.interception.aiTag : d.interception.localTag}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-azm-ink">{dialog.message}</p>
            </div>

            {/* break result */}
            {breakDecision && breakDecision.status === "granted" && (
              <button
                onClick={() => store.applyBreak(breakDecision.minutes || 5)}
                className="azm-btn mt-4 flex w-full items-center justify-center gap-2 border border-azm-info/40 bg-azm-info/15 px-5 py-3 text-sm font-bold text-azm-info hover:bg-azm-info/25 transition-colors"
              >
                <Coffee size={16} />
                {d.dialog.breakGranted} — {breakDecision.minutes || 5} {d.dialog.breakMinutes}
              </button>
            )}
            {breakDecision && breakDecision.status === "denied" && (
              <button
                onClick={store.closeDialog}
                className="azm-btn mt-4 w-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors"
              >
                {d.session.phaseWork}
              </button>
            )}

            {/* end result options */}
            {endAction && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  onClick={store.closeDialog}
                  className="azm-btn border border-azm-ok/40 bg-azm-ok/10 px-4 py-2.5 text-sm font-bold text-azm-ok hover:bg-azm-ok/20 transition-colors"
                >
                  {d.dialog.optContinue}
                </button>
                <button
                  onClick={store.dialogToBreak}
                  className="azm-btn border border-azm-info/40 bg-azm-info/10 px-4 py-2.5 text-sm font-semibold text-azm-info hover:bg-azm-info/20 transition-colors"
                >
                  {d.dialog.optBreak}
                </button>
                <button
                  onClick={() => void store.useEmergencyPass()}
                  disabled={store.weeklyPassUsed}
                  title={store.weeklyPassUsed ? d.dialog.passUsed : d.dialog.passAvailable}
                  className="azm-btn flex items-center justify-center gap-1.5 border border-azm-warn/40 bg-azm-warn/10 px-4 py-2.5 text-sm font-semibold text-azm-warn hover:bg-azm-warn/20 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <Ticket size={15} />
                  {d.dialog.optPass}
                </button>
                <button
                  onClick={store.confirmEnd}
                  className="azm-btn border border-azm-bad/40 bg-azm-bad/10 px-4 py-2.5 text-sm font-semibold text-azm-bad hover:bg-azm-bad/20 transition-colors"
                >
                  {d.dialog.optConfirm}
                </button>
                <p className="col-span-full text-[11px] leading-relaxed text-azm-muted">
                  {store.weeklyPassUsed ? d.dialog.passUsed : d.dialog.passNote}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
