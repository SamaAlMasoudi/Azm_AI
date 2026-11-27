/* Azm — end-of-session summary with achievement verification + full session
 * report (interventions log, temporary grants, what the agent learned). */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { SessionReportData, SessionSummaryData } from "@/lib/azm/types";
import { SabrTree } from "./SabrTree";
import {
  Trophy, Medal, Hourglass, Plus, LayoutDashboard, Save, ShieldCheck, ShieldAlert, HelpCircle,
  Repeat, FileText, KeyRound, BrainCircuit, ScrollText,
} from "lucide-react";

type ReportTab = "overview" | "interventions" | "grants" | "memory";

const VERDICT_LABEL: Record<string, { ar: string; en: string }> = {
  approved: { ar: "مقبول", en: "approved" },
  rejected: { ar: "مرفوض", en: "rejected" },
  timeout: { ar: "انتهت المهلة", en: "timeout" },
  self_corrected: { ar: "تراجع ذاتي", en: "self-corrected" },
  granted_break: { ar: "استراحة ممنوحة", en: "break granted" },
};

const CLASS_LABEL: Record<string, { ar: string; en: string }> = {
  supportive: { ar: "داعم", en: "supportive" },
  uncertain: { ar: "غير مؤكد", en: "uncertain" },
  distracting: { ar: "مشتت", en: "distracting" },
  none: { ar: "—", en: "—" },
};

function verdictColor(v: string): string {
  if (v === "approved" || v === "granted_break") return "#34D399";
  if (v === "rejected" || v === "timeout") return "#FB7185";
  if (v === "self_corrected") return "#8B5CF6";
  return "#A79BC8";
}

export function SessionSummary() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const summary = store.summary as SessionSummaryData | null;
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<ReportTab>("overview");

  if (!summary) {
    return (
      <div className="azm-card p-10 text-center text-azm-muted">{d.common.empty}</div>
    );
  }

  const v = summary.verification;
  const report = summary.report;
  const title = summary.emergencyPassUsed
    ? d.summary.sessionEnded
    : v?.verdict === "achieved"
      ? d.summary.titleAchieved
      : v?.verdict === "partial"
        ? d.summary.titlePartial
        : d.summary.titleNotAchieved;
  const bannerColor =
    summary.emergencyPassUsed
      ? "#FBBF24"
      : v?.verdict === "achieved"
        ? "#34D399"
        : v?.verdict === "partial"
          ? "#FBBF24"
          : "#FB7185";

  const savedMinutes = summary.interventionsBlocked * 6;

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "overview", label: d.report.tabOverview, icon: <FileText size={13} />, count: 0 },
    { id: "interventions", label: d.report.tabInterventions, icon: <ScrollText size={13} />, count: report?.interventions.length ?? 0 },
    { id: "grants", label: d.report.tabGrants, icon: <KeyRound size={13} />, count: report?.grants.length ?? 0 },
    { id: "memory", label: d.report.tabMemory, icon: <BrainCircuit size={13} />, count: report?.memoryAdded.length ?? 0 },
  ];

  return (
    <div className="space-y-6 azm-rise">
      {/* verdict banner */}
      <section className="azm-card p-6 md:p-8" style={{ borderColor: `${bannerColor}55` }}>
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `${bannerColor}1a`, color: bannerColor }}
          >
            {v?.verdict === "achieved" ? <Trophy size={30} /> : <Medal size={30} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-azm-muted">{d.summary.sessionEnded}</p>
            <h1 className="mt-0.5 text-2xl md:text-3xl font-bold" style={{ color: bannerColor }}>
              {title}
            </h1>
            {v && !summary.emergencyPassUsed && (
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-azm-ink">{v.message}</p>
            )}
            {summary.emergencyPassUsed && (
              <p className="mt-2 text-[13px] text-azm-warn">{d.summary.passUsedNote}</p>
            )}
          </div>
        </div>
      </section>

      {/* stats + tree */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="azm-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-azm-soft">
            <Hourglass size={16} className="text-azm-primary" />
            {d.summary.statsTitle}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: d.summary.focusedTime, value: `${Math.floor(summary.focusedSeconds / 60)} ${d.dashboard.minutes}`, color: "#8B5CF6" },
              { label: d.summary.protectedTime, value: `${savedMinutes} ${d.dashboard.minutes}`, color: "#34D399" },
              { label: d.summary.roundsCompleted, value: summary.rounds, color: "#EDE9FE" },
              { label: d.analytics.statAttempts, value: summary.distractionAttempts, color: "#FB7185" },
              { label: d.analytics.statBlocked, value: summary.interventionsBlocked, color: "#34D399" },
              { label: d.dashboard.statSupportive, value: summary.interventionsApproved, color: "#34D399" },
              { label: d.dashboard.statUncertain, value: summary.interventionsUncertain, color: "#FBBF24" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[12px] font-medium text-azm-muted">{s.label}</p>
                <p className="azm-nums mt-1 text-xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
            <span className="flex items-center gap-1.5 rounded-full border border-azm-ok/30 bg-azm-ok/10 px-3 py-1 text-azm-ok">
              <ShieldCheck size={13} />
              {d.analytics.classSupportive}: {summary.interventionsApproved}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-azm-warn/30 bg-azm-warn/10 px-3 py-1 text-azm-warn">
              <HelpCircle size={13} />
              {d.analytics.classUncertain}: {summary.interventionsUncertain}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-azm-bad/30 bg-azm-bad/10 px-3 py-1 text-azm-bad">
              <ShieldAlert size={13} />
              {d.analytics.classDistracting}: {summary.interventionsBlocked}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-azm-muted">
              <Repeat size={13} />
              {d.summary.roundsCompleted}: {summary.rounds}
            </span>
          </div>
        </section>

        <section className="azm-card flex flex-col items-center p-6">
          <h2 className="mb-2 text-sm font-semibold text-azm-soft">{d.summary.treeFinal}</h2>
          <SabrTree stage={summary.treeStage} size={210} />
        </section>
      </div>

      {/* session report */}
      <section className="azm-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#120A1F] px-4 py-3">
          <h2 className="me-2 flex items-center gap-2 text-sm font-bold text-azm-ink">
            <FileText size={15} className="text-azm-primary" />
            {d.report.title}
          </h2>
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`azm-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                tab === tb.id ? "bg-azm-primary text-white" : "border border-white/10 bg-white/5 text-azm-muted hover:text-azm-ink"
              }`}
            >
              {tb.icon}
              {tb.label}
              {tb.count > 0 && (
                <span className={`azm-nums rounded-full px-1.5 text-[10px] ${tab === tb.id ? "bg-white/20" : "bg-white/10"}`} dir="ltr">
                  {tb.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "overview" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(report
                ? [
                    { label: d.levels.title, value: d.levels[(report as SessionReportData).level] ?? report.level },
                    { label: d.session.breakBudgetLine, value: `${report.breakUsedMin}/${report.breakBudgetMin} ${d.dialog.breakMinutes}` },
                    { label: d.report.tabGrants, value: `${report.grants.length}` },
                    { label: d.report.tabInterventions, value: `${report.interventions.length}` },
                  ]
                : [
                    { label: d.levels.title, value: d.levels.balanced },
                    { label: d.report.tabInterventions, value: "0" },
                  ]
              ).map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[12px] font-medium text-azm-muted">{s.label}</p>
                  <p className="mt-1 text-[15px] font-bold text-azm-ink">{s.value}</p>
                </div>
              ))}
              {report?.accomplishments ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2 lg:col-span-4">
                  <p className="text-[12px] font-medium text-azm-muted">{d.dialog.verifyTitle}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-azm-ink">{report.accomplishments}</p>
                </div>
              ) : null}
            </div>
          )}

          {tab === "interventions" && (
            <div className="max-h-80 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
              {!report || report.interventions.length === 0 && <p className="py-4 text-center text-[13px] text-azm-muted">{d.report.empty}</p>}
              {report?.interventions.map((i) => (
                <div key={i.id} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{ color: verdictColor(i.verdict), background: `${verdictColor(i.verdict)}1a` }}
                    >
                      {VERDICT_LABEL[i.verdict]?.[lang] ?? i.verdict}
                    </span>
                    <span className="font-bold text-azm-ink" dir="ltr">{i.site || i.url || "—"}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-azm-muted">
                      {CLASS_LABEL[i.classification]?.[lang] ?? i.classification}
                    </span>
                    <span className="ms-auto azm-nums text-[10px] text-azm-muted" dir="ltr">
                      {new Date(i.at).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {i.explanation && (
                    <p className="mt-2 text-[12px] leading-relaxed text-azm-muted">
                      <span className="font-semibold text-azm-soft">{d.report.explanation}: </span>
                      {i.explanation}
                    </p>
                  )}
                  {i.aiMessage && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-azm-ink">
                      <span className="font-semibold text-azm-primary">{d.report.agentSaid}: </span>
                      {i.aiMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "grants" && (
            <div className="max-h-80 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
              {(!report || report.grants.length === 0) && <p className="py-4 text-center text-[13px] text-azm-muted">{d.report.grantsEmpty}</p>}
              {report?.grants.map((g, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-2xl border border-azm-ok/25 bg-azm-ok/5 p-3.5">
                  <KeyRound size={14} className="text-azm-ok" />
                  <span className="font-bold text-azm-ink" dir="ltr">{g.domain}</span>
                  <span className="azm-nums rounded-full border border-azm-ok/40 bg-azm-ok/10 px-2 py-0.5 text-[10px] font-bold text-azm-ok" dir="ltr">
                    {g.minutes} {d.dialog.breakMinutes}
                  </span>
                  {g.reason && <p className="w-full text-[12px] leading-relaxed text-azm-muted">"{g.reason}"</p>}
                </div>
              ))}
            </div>
          )}

          {tab === "memory" && (
            <div className="max-h-80 space-y-2 overflow-y-auto pe-1" style={{ scrollbarWidth: "thin" }}>
              {(!report || report.memoryAdded.length === 0) && <p className="py-4 text-center text-[13px] text-azm-muted">{d.report.memoryEmpty}</p>}
              {report?.memoryAdded.map((m, idx) => (
                <div key={idx} className="flex items-start gap-2.5 rounded-2xl border border-azm-primary/25 bg-azm-primary/5 p-3.5">
                  <BrainCircuit size={14} className="mt-0.5 shrink-0 text-azm-primary" />
                  <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-azm-ink">{m.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* actions */}
      <section className="flex flex-wrap gap-3">
        <button
          onClick={async () => {
            store.setDraft({
              name: summary.config.goal.slice(0, 40),
              goal: summary.config.goal,
              task: summary.config.task,
              expectedOutcome: summary.config.expectedOutcome,
              technique: summary.config.technique,
              workMinutes: summary.config.workMinutes,
              breakMinutes: summary.config.breakMinutes,
              personality: summary.config.personality,
              allowedSites: summary.config.allowedSites,
            });
            await store.saveGroup();
            setSaved(true);
            toast.success(d.toasts.groupSaved);
          }}
          disabled={saved}
          className="azm-btn flex items-center gap-2 border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saved ? d.summary.savedCta : d.summary.saveGroupCta}
        </button>
        <button
          onClick={() => {
            store.resetDraft();
            store.setView("setup");
          }}
          className="azm-btn flex items-center gap-2 bg-[#7C3AED] px-6 py-3 text-sm font-bold text-white hover:bg-[#8B5CF6] transition-colors azm-glow"
        >
          <Plus size={16} />
          {d.summary.newSessionCta}
        </button>
        <button
          onClick={() => store.setView("dashboard")}
          className="azm-btn border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-azm-muted hover:text-azm-ink transition-colors"
        >
          <LayoutDashboard size={16} className="mx-1.5 inline" />
          {d.summary.dashboardCta}
        </button>
      </section>
    </div>
  );
}
