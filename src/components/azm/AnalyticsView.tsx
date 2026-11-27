/* Azm — analytics dashboard: focus statement, scope stats, 7-day bars, recent interventions */

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AnalyticsSummary, InterventionDTO, Lang } from "@/lib/azm/types";
import { apiAnalytics } from "@/lib/azm/api";
import { getDict } from "@/lib/azm/i18n";
import { AZM, hexToRgba } from "@/lib/azm/tokens";
import { LogoBadge } from "./Logo";

type Scope = "week" | "total";
type Verdict = InterventionDTO["verdict"];
type Classification = InterventionDTO["classification"];
type StatTone = "ink" | "ok" | "bad";

interface StatCard {
  label: string;
  value: string;
  tone: StatTone;
}

const TONE_CLS: Record<StatTone, string> = {
  ink: "text-azm-ink",
  ok: "text-azm-ok",
  bad: "text-azm-bad",
};

const VERDICT_CLS: Record<Verdict, string> = {
  approved: "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30",
  rejected: "bg-[#FB7185]/15 text-[#FB7185] border border-[#FB7185]/30",
  timeout: "bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30",
  self_corrected: "bg-[#60A5FA]/15 text-[#60A5FA] border border-[#60A5FA]/30",
};

const CLASSIFICATION_CLS: Record<Classification, string> = {
  supportive: "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30",
  uncertain: "bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30",
  distracting: "bg-[#FB7185]/15 text-[#FB7185] border border-[#FB7185]/30",
  none: "bg-white/5 text-azm-muted border border-white/10",
};

const BAR_GRADIENT = "linear-gradient(180deg, #A78BFA, #7C3AED)";

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function PulseBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-white/5 ${className}`} />;
}

export function AnalyticsView({ lang }: { lang: Lang }) {
  const d = getDict(lang);
  const locale = lang === "ar" ? "ar" : "en";

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("week");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const json = await apiAnalytics();
      setData(json);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <header className="space-y-1">
      <h1 className="text-2xl font-bold text-azm-ink md:text-3xl">{d.analytics.title}</h1>
      <p className="text-azm-muted">{d.analytics.subtitle}</p>
    </header>
  );

  if (loading) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="azm-rise space-y-6">
        {header}
        <PulseBlock className="h-36 rounded-[20px]" />
        <PulseBlock className="h-10 w-44 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <PulseBlock key={i} className="h-24 rounded-[20px]" />
          ))}
        </div>
        <PulseBlock className="h-72 rounded-[20px]" />
        <PulseBlock className="h-64 rounded-[20px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="azm-rise space-y-6">
        {header}
        <section className="azm-card p-8 text-center">
          <p className="text-azm-muted">{d.common.networkError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="azm-btn mt-4 bg-[#7C3AED] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#8B5CF6]"
          >
            {d.common.retry}
          </button>
        </section>
      </div>
    );
  }

  const summary = data;
  const saved = summary.week.savedHours;

  const verdictLabels: Record<Verdict, string> = {
    approved: d.analytics.verdictApproved,
    rejected: d.analytics.verdictRejected,
    timeout: d.analytics.verdictTimeout,
    self_corrected: d.analytics.verdictSelf,
  };
  const classLabels: Record<Classification, string> = {
    supportive: d.analytics.classSupportive,
    uncertain: d.analytics.classUncertain,
    distracting: d.analytics.classDistracting,
    none: d.analytics.classNone,
  };

  const stats: StatCard[] =
    scope === "week"
      ? [
          { label: d.analytics.statSessions, value: String(summary.week.sessions), tone: "ink" },
          { label: d.analytics.statFocused, value: summary.week.focusedHours.toFixed(1), tone: "ink" },
          { label: d.analytics.statProtected, value: summary.week.savedHours.toFixed(1), tone: "ink" },
          { label: d.analytics.statAttempts, value: String(summary.week.attempts), tone: "bad" },
          { label: d.analytics.statBlocked, value: String(summary.week.blocked), tone: "ok" },
          { label: d.analytics.statApproved, value: String(summary.week.approved), tone: "ink" },
          { label: d.analytics.statUncertain, value: String(summary.week.uncertain), tone: "ink" },
          { label: d.analytics.verdictSelf, value: String(summary.week.selfCorrected), tone: "ink" },
        ]
      : [
          { label: d.analytics.statSessions, value: String(summary.total.sessions), tone: "ink" },
          { label: d.analytics.statFocused, value: summary.total.focusedHours.toFixed(1), tone: "ink" },
          {
            label: d.analytics.statProtected,
            value: (summary.total.focusedHours + summary.total.blocked * 0.1).toFixed(1),
            tone: "ink",
          },
          { label: d.analytics.statAttempts, value: String(summary.total.attempts), tone: "bad" },
          { label: d.analytics.statBlocked, value: String(summary.total.blocked), tone: "ok" },
          { label: d.analytics.statApproved, value: String(summary.total.approved), tone: "ink" },
          { label: d.analytics.statUncertain, value: String(summary.total.uncertain), tone: "ink" },
        ];

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdayLabel = (iso: string): string => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : weekdayFmt.format(date);
  };
  const timeLabel = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  };

  const cap = Math.max(60, ...summary.daily.map((day) => day.focusedMinutes));
  const hasFocus = summary.daily.length > 0 && summary.daily.some((day) => day.focusedMinutes > 0);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="azm-rise space-y-6">
      {header}

      {/* Hero statement */}
      <section className="azm-card azm-glow p-6 md:p-8">
        <div className="flex items-center gap-4 md:gap-5">
          <LogoBadge size={52} className="shrink-0" />
          <div className="min-w-0 flex-1">
            {saved > 0 ? (
              <p className="text-3xl font-bold leading-tight text-azm-ink md:text-4xl">
                {d.analytics.statementPre}{" "}
                <span className="azm-nums text-azm-primary">{saved.toFixed(1)}</span>{" "}
                {d.analytics.statementPost}
              </p>
            ) : (
              <p className="text-lg text-azm-muted">{d.analytics.statementZero}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="azm-nums rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-azm-muted">
                {summary.week.weekKey}
              </span>
              <span className="text-sm text-azm-muted">
                {summary.week.sessions} {d.analytics.statSessions}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Scope toggle + stats grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScope("week")}
            aria-pressed={scope === "week"}
            className={
              scope === "week"
                ? "azm-btn bg-[#7C3AED] px-4 py-1.5 text-[13px] font-medium text-white"
                : "azm-btn border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] font-medium text-azm-muted transition-colors hover:text-azm-ink"
            }
          >
            {d.analytics.weekLabel}
          </button>
          <button
            type="button"
            onClick={() => setScope("total")}
            aria-pressed={scope === "total"}
            className={
              scope === "total"
                ? "azm-btn bg-[#7C3AED] px-4 py-1.5 text-[13px] font-medium text-white"
                : "azm-btn border border-white/10 bg-white/5 px-4 py-1.5 text-[13px] font-medium text-azm-muted transition-colors hover:text-azm-ink"
            }
          >
            {d.analytics.totalLabel}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="azm-card p-4">
              <p className="text-[13px] font-medium text-azm-muted">{s.label}</p>
              <p className={`azm-nums mt-1 text-2xl font-bold ${TONE_CLS[s.tone]}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7-day focus bars */}
      <section className="azm-card p-6">
        <h2 className="text-lg font-semibold text-azm-soft">{d.analytics.chartTitle}</h2>
        <p className="mt-1 text-[13px] text-azm-muted">{d.analytics.chartSub}</p>
        {hasFocus ? (
          <>
            <div className="mt-6 flex h-40 items-end gap-2">
              {summary.daily.map((day) => (
                <div
                  key={day.date}
                  className="flex h-full flex-1 flex-col items-center justify-end"
                  title={`${weekdayLabel(day.date)} · ${day.focusedMinutes}`}
                >
                  <span className="azm-nums mb-1 flex h-4 items-end text-[11px] text-azm-muted">
                    {day.focusedMinutes > 0 ? day.focusedMinutes : null}
                  </span>
                  <div className="flex h-[120px] w-full items-end">
                    <div
                      className="w-full rounded-t-lg transition-opacity duration-200 hover:opacity-80"
                      style={{
                        height: `${Math.round((day.focusedMinutes / cap) * 100)}%`,
                        minHeight: 4,
                        background: BAR_GRADIENT,
                        boxShadow: `0 4px 16px ${hexToRgba(AZM.strong, 0.28)}`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              {summary.daily.map((day) => (
                <div key={day.date} className="flex-1 text-center text-[11px] text-azm-muted">
                  {weekdayLabel(day.date)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-azm-muted">{d.analytics.chartEmpty}</p>
        )}
      </section>

      {/* Recent interventions */}
      <section className="azm-card p-6">
        <h2 className="text-lg font-semibold text-azm-soft">{d.analytics.tableTitle}</h2>
        {summary.recent.length === 0 ? (
          <p className="py-8 text-center text-azm-muted">{d.analytics.empty}</p>
        ) : (
          <ul className="azm-scroll mt-2 max-h-72 divide-y divide-white/5 overflow-y-auto">
            {summary.recent.map((iv) => (
              <li key={iv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-azm-ink">{iv.siteName}</p>
                  <p className="mt-0.5 max-w-[220px] truncate text-xs text-azm-muted">{iv.siteUrl}</p>
                </div>
                <span className="azm-nums whitespace-nowrap text-xs text-azm-muted">
                  {timeLabel(iv.createdAt)}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge className={VERDICT_CLS[iv.verdict]}>{verdictLabels[iv.verdict]}</Badge>
                  <Badge className={CLASSIFICATION_CLS[iv.classification]}>
                    {classLabels[iv.classification]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
