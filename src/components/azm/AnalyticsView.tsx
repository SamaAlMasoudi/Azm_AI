/* Azm — analytics dashboard: synced with extension dashboard design */

"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AnalyticsSummary, InterventionDTO, Lang } from "@/lib/azm/types";
import { apiAnalytics } from "@/lib/azm/api";
import { getDict } from "@/lib/azm/i18n";
import { AZM, hexToRgba } from "@/lib/azm/tokens";
import { LogoBadge } from "./Logo";
import { BarChart3, Clock } from "lucide-react";

type Scope = "week" | "total";
type Verdict = InterventionDTO["verdict"];
type Classification = InterventionDTO["classification"];
type StatTone = "ink" | "ok" | "bad" | "warn";

interface StatCard {
  label: string;
  value: string;
  tone: StatTone;
}

const TONE_COLOR: Record<StatTone, string> = {
  ink: "#A78BFA",
  ok: "#34D399",
  bad: "#FB7185",
  warn: "#FBBF24",
};

const VERDICT_CLS: Record<Verdict, string> = {
  approved: "bg-[#34D399]/14 text-[#34D399] border border-[#34D399]/35",
  rejected: "bg-[#FB7185]/14 text-[#FB7185] border border-[#FB7185]/35",
  timeout: "bg-[#FBBF24]/14 text-[#FBBF24] border border-[#FBBF24]/35",
  self_corrected: "bg-[#8B5CF6]/16 text-[#A78BFA] border border-[#8B5CF6]/35",
};

const CLASSIFICATION_CLS: Record<Classification, string> = {
  supportive: "bg-[#34D399]/14 text-[#34D399] border border-[#34D399]/35",
  uncertain: "bg-[#FBBF24]/14 text-[#FBBF24] border border-[#FBBF24]/35",
  distracting: "bg-[#FB7185]/14 text-[#FB7185] border border-[#FB7185]/35",
  none: "bg-[#1A1230] text-[#A79BC8] border border-[#A79BC8]/20",
};

const BAR_GRADIENT = "linear-gradient(180deg, #A78BFA, #7C3AED)";

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${className}`}
    >
      {children}
    </span>
  );
}

function PulseBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse bg-[#1A1230] ${className}`} />;
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
      <h1 className="text-[26px] font-extrabold leading-snug text-[#F4F0FC]">{d.analytics.title}</h1>
      <p className="text-[15px] text-[#A79BC8]">{d.analytics.subtitle}</p>
    </header>
  );

  if (loading) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="azm-rise space-y-6">
        {header}
        <PulseBlock className="h-36 rounded-[18px]" />
        <PulseBlock className="h-10 w-44 rounded-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <PulseBlock key={i} className="h-24 rounded-[18px]" />
          ))}
        </div>
        <PulseBlock className="h-72 rounded-[18px]" />
        <PulseBlock className="h-64 rounded-[18px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="azm-rise space-y-6">
        {header}
        <section className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-8 text-center">
          <p className="text-[#A79BC8]">{d.common.networkError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-[12px] bg-[#7C3AED] px-5 py-2.5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] transition-colors hover:bg-[#8B5CF6]"
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
          { label: d.analytics.statProtected, value: summary.week.savedHours.toFixed(1), tone: "ok" },
          { label: d.analytics.statAttempts, value: String(summary.week.attempts), tone: "bad" },
          { label: d.analytics.statBlocked, value: String(summary.week.blocked), tone: "ok" },
          { label: d.analytics.statApproved, value: String(summary.week.approved), tone: "ok" },
          { label: d.analytics.statUncertain, value: String(summary.week.uncertain), tone: "warn" },
          { label: d.analytics.verdictSelf, value: String(summary.week.selfCorrected), tone: "ink" },
        ]
      : [
          { label: d.analytics.statSessions, value: String(summary.total.sessions), tone: "ink" },
          { label: d.analytics.statFocused, value: summary.total.focusedHours.toFixed(1), tone: "ink" },
          {
            label: d.analytics.statProtected,
            value: (summary.total.focusedHours + summary.total.blocked * 0.1).toFixed(1),
            tone: "ok",
          },
          { label: d.analytics.statAttempts, value: String(summary.total.attempts), tone: "bad" },
          { label: d.analytics.statBlocked, value: String(summary.total.blocked), tone: "ok" },
          { label: d.analytics.statApproved, value: String(summary.total.approved), tone: "ok" },
          { label: d.analytics.statUncertain, value: String(summary.total.uncertain), tone: "warn" },
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
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="azm-rise flex flex-col gap-6">
      {header}

      {/* Hero statement */}
      <section
        className="relative overflow-hidden rounded-[18px] border border-[#A79BC8]/34 p-6 md:p-7"
        style={{
          background:
            "radial-gradient(520px 260px at 100% 0%, rgba(124, 58, 237, 0.35), transparent 65%), linear-gradient(160deg, #1A1230, #130C22)",
        }}
      >
        <div className="flex items-center gap-4 md:gap-5">
          <LogoBadge size={52} className="shrink-0" />
          <div className="min-w-0 flex-1">
            {saved > 0 ? (
              <p className="text-2xl font-extrabold leading-tight text-[#F4F0FC] md:text-3xl">
                {d.analytics.statementPre}{" "}
                <span className="tabular-nums text-[#A78BFA]">{saved.toFixed(1)}</span>{" "}
                {d.analytics.statementPost}
              </p>
            ) : (
              <p className="text-base text-[#A79BC8] md:text-lg">{d.analytics.statementZero}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="tabular-nums rounded-full bg-[#241946] px-3 py-1 text-xs font-semibold text-[#A79BC8]">
                {summary.week.weekKey}
              </span>
              <span className="text-sm text-[#A79BC8]">
                {summary.week.sessions} {d.analytics.statSessions}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Scope toggle + stats grid */}
      <section className="flex flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[#A79BC8]/20 bg-[#1A1230] p-1">
          <button
            type="button"
            onClick={() => setScope("week")}
            aria-pressed={scope === "week"}
            className={`rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors ${
              scope === "week"
                ? "bg-[#241946] text-[#A78BFA]"
                : "text-[#A79BC8] hover:text-[#F4F0FC]"
            }`}
          >
            {d.analytics.weekLabel}
          </button>
          <button
            type="button"
            onClick={() => setScope("total")}
            aria-pressed={scope === "total"}
            className={`rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors ${
              scope === "total"
                ? "bg-[#241946] text-[#A78BFA]"
                : "text-[#A79BC8] hover:text-[#F4F0FC]"
            }`}
          >
            {d.analytics.totalLabel}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => {
            const color = TONE_COLOR[s.tone];
            return (
              <div
                key={s.label}
                className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] px-4 py-4"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <p className="text-[13px] text-[#A79BC8]">{s.label}</p>
                <p className="mt-1 text-[30px] font-extrabold leading-tight tabular-nums" style={{ color }}>
                  {s.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7-day focus bars */}
      <section className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-6">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <BarChart3 size={19} className="text-[#A78BFA]" />
          <span>{d.analytics.chartTitle}</span>
        </h2>
        <p className="mt-1 text-[13.5px] text-[#A79BC8]">{d.analytics.chartSub}</p>
        {hasFocus ? (
          <>
            <div className="mt-6 flex h-40 items-end gap-2">
              {summary.daily.map((day) => (
                <div
                  key={day.date}
                  className="flex h-full flex-1 flex-col items-center justify-end"
                  title={`${weekdayLabel(day.date)} · ${day.focusedMinutes}`}
                >
                  <span className="tabular-nums mb-1 flex h-4 items-end text-[11px] text-[#A79BC8]">
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
                <div key={day.date} className="flex-1 text-center text-[11.5px] text-[#A79BC8]">
                  {weekdayLabel(day.date)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-[14px] border border-dashed border-[#A79BC8]/30 bg-[#1A1230]/40 py-10 text-center text-sm text-[#A79BC8]">
            {d.analytics.chartEmpty}
          </div>
        )}
      </section>

      {/* Recent interventions */}
      <section className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-6">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <Clock size={19} className="text-[#A78BFA]" />
          <span>{d.analytics.tableTitle}</span>
        </h2>
        {summary.recent.length === 0 ? (
          <div className="mt-4 rounded-[14px] border border-dashed border-[#A79BC8]/30 bg-[#1A1230]/40 py-8 text-center text-sm text-[#A79BC8]">
            {d.analytics.empty}
          </div>
        ) : (
          <ul className="azm-scroll mt-3 max-h-72 divide-y divide-[#A79BC8]/14 overflow-y-auto">
            {summary.recent.map((iv) => (
              <li key={iv.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#F4F0FC]">{iv.siteName}</p>
                  <p className="mt-0.5 max-w-[240px] truncate text-xs text-[#A79BC8]" dir="ltr">
                    {iv.siteUrl}
                  </p>
                </div>
                <span className="tabular-nums whitespace-nowrap text-xs text-[#A79BC8]">
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