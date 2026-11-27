/* Azm — interception overlay: a multi-round conversation with the agent.
 * Configurable countdown (profile setting, default 30s) to justify an
 * off-goal navigation; the agent may ask follow-up questions, grant
 * temporary access, or refuse. The student can extend the window ("more
 * time", capped) and is never cut off mid-sentence: at expiry with a draft
 * on screen the timer pauses instead of rejecting. */

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { Orb } from "./Orb";
import { AZM, hexToRgba } from "@/lib/azm/tokens";
import { SITE_CATALOG } from "@/lib/azm/sites-data";
import { Check, HelpCircle, ShieldAlert, Ban, Loader2, Send, Clock3, BrainCircuit, Timer, AlertTriangle } from "lucide-react";

function siteLabel(domain: string, lang: "ar" | "en"): string {
  const host = domain.replace(/^www\./, "");
  const site = SITE_CATALOG.find((s) => host === s.host || host.endsWith(`.${s.host}`));
  if (site) return site.name[lang];
  const bare = host.split(".").slice(-2).join(".");
  return bare || domain;
}

interface IntentBadge {
  label: string;
  color: string;
}

function CountdownRing({ seconds, total, warn }: { seconds: number; total: number; warn: boolean }) {
  const pct = Math.max(0, seconds / Math.max(1, total));
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = warn ? AZM.warn : AZM.bad;
  return (
    <div className={`relative h-[76px] w-[76px] ${warn ? "azm-breathe" : ""}`}>
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="6" stroke="rgba(255,255,255,0.08)" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          strokeWidth="6"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="azm-nums absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ color }}>
        {seconds}
      </span>
    </div>
  );
}

export function InterceptionOverlay() {
  const interception = useAzm((s) => s.interception);
  if (!interception) return null;
  // keyed by challenge so countdown/text state resets per interception
  return <InterceptionInner key={interception.challenge.id} />;
}

function InterceptionInner() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const active = store.active;
  const interception = store.interception;
  const challenge = interception!.challenge;
  const initialDeadline = interception?.challenge.deadline ?? (interception ? Date.now() + interception.challenge.timerSec * 1000 : Date.now());
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((initialDeadline - Date.now()) / 1000)));
  const [text, setText] = useState("");
  const warnedRef = useRef(false);
  const textRef = useRef("");
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // each new agent round asks a DIFFERENT question: start it with a clean
  // draft (and keep focus — the textarea is never remounted) so the previous
  // round's answer can't be resubmitted by accident
  const roundRef = useRef(challenge.round);
  useEffect(() => {
    if (challenge.round !== roundRef.current) {
      roundRef.current = challenge.round;
      setText("");
    }
  }, [challenge.round]);

  // countdown re-arms on each new "asking" round (deadline from the server)
  useEffect(() => {
    if (!interception || interception.phase !== "justify") return;
    const deadline = interception.challenge.deadline ?? Date.now() + interception.challenge.timerSec * 1000;
    warnedRef.current = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(left);
      // pre-expiry notification once per round (amber warning + pulse below 10s)
      if (left > 0 && left <= 10 && !warnedRef.current) {
        warnedRef.current = true;
        toast.warning(d.interception.urgentToast);
      }
      if (left <= 0) store.interceptionTimeout(Boolean(textRef.current.trim()));
    };
    // first tick is async so the effect body never sets state synchronously
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
     
  }, [interception?.phase, interception?.challenge.deadline]);

  // auto-scroll conversation
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [challenge.lines.length, interception?.phase]);

  if (!active || !interception) return null;

  const phase = interception.phase;
  const result = interception.result;
  const isAllowed = result?.status === "granted";
  const extensionsLeft = Math.max(0, 3 - (challenge.extensions ?? 0));
  const urgent = phase === "justify" && seconds > 0 && seconds <= 10;

  const badge: IntentBadge =
    challenge.classification === "unrelated"
      ? { label: d.interception.classUnrelated, color: AZM.bad }
      : challenge.classification === "relevant"
        ? { label: d.interception.classRelevant, color: AZM.ok }
        : { label: d.interception.classUncertain, color: AZM.warn };

  const verdictStyle = isAllowed
    ? result?.classification === "uncertain"
      ? { border: "rgba(251,191,36,0.4)", color: AZM.warn, icon: <HelpCircle size={22} />, title: d.interception.verdictUncertain }
      : { border: "rgba(52,211,153,0.4)", color: AZM.ok, icon: <Check size={22} />, title: d.interception.verdictApproved }
    : { border: "rgba(251,113,133,0.4)", color: AZM.bad, icon: <Ban size={22} />, title: d.interception.verdictRejected };

  const lastAzmLine = [...challenge.lines].reverse().find((l) => l.role === "azm");

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4"
      style={{ background: "rgba(10, 6, 18, 0.88)" }}
      role="alertdialog"
      aria-modal="true"
      aria-label={d.interception.title}
    >
      <div className="azm-card azm-pop flex max-h-full w-full max-w-lg flex-col overflow-hidden" style={{ borderColor: hexToRgba(AZM.bad, 0.45) }}>
        {/* header */}
        <div className="flex items-center gap-4 border-b border-white/10 bg-[#120A1F] p-5">
          <Orb state="alert" size={56} float={false} />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-azm-ink">{d.interception.title}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className="flex items-center gap-1 text-azm-soft">
                <ShieldAlert size={13} />
                <span className="font-semibold">{siteLabel(challenge.domain, lang)}</span>
              </span>
              <span dir="ltr" className="max-w-[220px] truncate text-azm-muted">
                {challenge.url || challenge.domain}
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{ borderColor: hexToRgba(badge.color, 0.4), color: badge.color, background: hexToRgba(badge.color, 0.08) }}
              >
                {badge.label}
              </span>
            </div>
          </div>
          {phase === "justify" && <CountdownRing seconds={seconds} total={challenge.timerSec} warn={urgent} />}
        </div>

        {/* conversation */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: 300 }}>
          {challenge.reason && (
            <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <BrainCircuit size={15} className="mt-0.5 shrink-0 text-azm-primary" />
              <div>
                <p className="text-[11px] font-semibold text-azm-muted">{d.interception.reasonLabel}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-azm-soft">{challenge.reason}</p>
              </div>
            </div>
          )}

          {challenge.lines.map((line, idx) => (
            <div key={idx} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                  line.role === "user"
                    ? "bg-azm-primary/20 text-azm-ink"
                    : "border border-white/10 bg-white/5 text-azm-ink"
                }`}
              >
                {line.text}
              </div>
            </div>
          ))}

          {phase === "evaluating" && (
            <div className="flex items-center gap-3 py-2">
              <Loader2 size={20} className="animate-spin text-azm-primary" />
              <span className="text-[14px] text-azm-ink azm-breathe">{d.interception.thinking}</span>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-5">
          {phase === "justify" && (
            <>
              <div className="mb-2 flex items-center justify-between text-[12px] text-azm-muted">
                <span>
                  {d.interception.roundLabel} {challenge.round}/{challenge.maxRounds} · {d.interception.countdownLabel}
                </span>
                <span className="flex items-center gap-2">
                  {challenge.round > 1 && <span className="text-azm-warn">{d.interception.followupHint}</span>}
                  {/* manual extension — capped, pauses the automated flow */}
                  <button
                    onClick={() => void store.extendChallengeWindow()}
                    disabled={extensionsLeft === 0}
                    className="azm-btn flex items-center gap-1.5 rounded-full border border-azm-warn/40 bg-azm-warn/10 px-3 py-1 text-[11px] font-semibold text-azm-warn transition-colors hover:bg-azm-warn/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`${d.interception.extendBtn} (+30s)`}
                  >
                    <Timer size={12} />
                    {d.interception.extendBtn} (+30s)
                  </button>
                </span>
              </div>
              {urgent && (
                <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-azm-warn" role="status" aria-live="polite">
                  <AlertTriangle size={13} />
                  {d.interception.urgentHint}
                </p>
              )}
              <label htmlFor="azm-justification" className="sr-only">
                {d.interception.justificationPlaceholder}
              </label>
              <textarea
                id="azm-justification"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={d.interception.justificationPlaceholder}
                className="azm-field min-h-[72px] w-full resize-none border border-white/10 bg-white/5 p-3.5 text-[14px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary focus:ring-2 focus:ring-azm-primary/30"
                autoFocus
                aria-describedby="azm-justification-hint"
              />
              <p id="azm-justification-hint" className="mt-1.5 text-[11px] text-azm-muted">
                {d.interception.justifyHint}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void store.submitJustification(text)}
                  disabled={!text.trim()}
                  className="azm-btn flex flex-1 items-center justify-center gap-2 bg-[#7C3AED] px-5 py-3 text-sm font-bold text-white hover:bg-[#8B5CF6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={15} />
                  {d.interception.submitBtn}
                </button>
                <button
                  onClick={store.selfCorrect}
                  className="azm-btn flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors"
                >
                  {d.interception.backToStudyBtn}
                </button>
              </div>
              {extensionsLeft > 0 && (
                <p className="mt-2 text-center text-[10px] text-azm-muted/70">
                  {d.interception.extensionsLeft.replace("{n}", String(extensionsLeft))}
                </p>
              )}
            </>
          )}

          {phase === "verdict" && result && (
            <div className="azm-rise">
              <div
                className="flex items-center gap-3 rounded-2xl border p-4"
                style={{ borderColor: verdictStyle.border, background: hexToRgba(verdictStyle.color, 0.08) }}
              >
                <span style={{ color: verdictStyle.color }}>{verdictStyle.icon}</span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold" style={{ color: verdictStyle.color }}>
                    {result.status === "timeout" ? d.interception.timeoutTitle : verdictStyle.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-azm-ink">{result.message}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-azm-muted border border-white/10">
                    {result.source === "ai" ? d.interception.aiTag : d.interception.localTag}
                  </span>
                  {isAllowed && result.minutes ? (
                    <span className="flex items-center gap-1 rounded-full border border-azm-ok/30 bg-azm-ok/10 px-2.5 py-1 text-[10px] font-semibold text-azm-ok">
                      <Clock3 size={11} />
                      {result.minutes} {d.dialog.breakMinutes} · {d.grants.title}
                    </span>
                  ) : null}
                </span>
                <button
                  onClick={store.dismissVerdict}
                  className={`azm-btn px-6 py-2.5 text-sm font-bold transition-colors ${
                    isAllowed
                      ? "bg-azm-ok/20 text-azm-ok border border-azm-ok/40 hover:bg-azm-ok/30"
                      : "bg-white/5 text-azm-soft border border-white/15 hover:bg-white/10"
                  }`}
                >
                  {isAllowed ? d.common.confirm : d.interception.backToStudyBtn}
                </button>
              </div>
              {lastAzmLine && !isAllowed && <p className="sr-only">{lastAzmLine.text}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
