/* Azm — dashboard: weekly statement, stats (brand 04), session groups, recommended tools */

"use client";

import { useEffect, useState } from "react";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { apiAnalytics } from "@/lib/azm/api";
import type { AnalyticsSummary, SessionGroupDTO } from "@/lib/azm/types";
import { LogoBadge } from "./Logo";
import { ToolRecommends } from "./ToolRecommends";
import {
  PlayCircle,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Zap,
  Sparkles,
  Plus,
  Layers,
} from "lucide-react";

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="azm-card azm-card-hover p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-azm-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="azm-nums mt-2 text-3xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: SessionGroupDTO }) {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);

  const launch = async () => {
    store.setDraft({
      name: group.name,
      goal: group.goal,
      task: group.task,
      expectedOutcome: group.expectedOutcome,
      technique: group.technique,
      workMinutes: group.workMinutes,
      breakMinutes: group.breakMinutes,
      personality: group.personality,
      allowedSites: group.allowedSites,
    });
    await store.startSession();
    store.resetDraft();
  };

  return (
    <div className="azm-card azm-card-hover p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-azm-ink">{group.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-azm-muted">{group.goal}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => store.editGroup(group)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-azm-muted hover:text-azm-ink hover:bg-white/10 transition-colors"
            aria-label={d.common.edit}
            title={d.common.edit}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => void store.deleteGroup(group.id)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-azm-muted hover:text-azm-bad hover:bg-azm-bad/10 transition-colors"
            aria-label={d.common.delete}
            title={d.common.delete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-azm-primary/30 bg-azm-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-azm-soft">
          {group.workMinutes} {d.dashboard.minutes} {d.dashboard.work} / {group.breakMinutes} {d.dashboard.breakWord}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-azm-muted">
          {d.setup[group.personality === "strict" ? "strict" : group.personality === "friend" ? "friend" : "philosopher"]}
        </span>
        <span className="rounded-full border border-azm-ok/30 bg-azm-ok/10 px-2.5 py-0.5 text-[11px] font-medium text-azm-ok">
          {group.allowedSites.length} {d.dashboard.resourcesCount}
        </span>
      </div>

      <button
        onClick={() => void launch()}
        className="azm-btn mt-auto flex w-full items-center justify-center gap-2 bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8B5CF6] transition-colors azm-glow"
      >
        <PlayCircle size={17} />
        {d.dashboard.groupLaunch}
      </button>
    </div>
  );
}

export function Dashboard() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    apiAnalytics()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [lang]);

  const savedHours = summary?.week.savedHours ?? 0;
  const w = summary?.week;

  return (
    <div className="space-y-8">
      {/* Hero statement */}
      <section className="azm-card azm-glow relative overflow-hidden p-6 md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 inset-inline-end -translate-x-1/4 w-80 h-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)" }}
        />
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <LogoBadge size={84} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-azm-ink">{d.dashboard.greeting}</h1>
            <p className="mt-1 text-azm-muted">{d.dashboard.greetingSub}</p>
            <div className="mt-4">
              {savedHours > 0 ? (
                <p className="text-xl md:text-2xl font-bold text-azm-soft">
                  {d.dashboard.statementSaved}{" "}
                  <span className="azm-nums text-3xl md:text-4xl text-azm-primary">
                    {savedHours.toFixed(1)}
                  </span>{" "}
                  {d.dashboard.statementHours}
                </p>
              ) : (
                <p className="text-base text-azm-muted">{d.dashboard.statementZero}</p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => {
                store.resetDraft();
                store.setView("setup");
              }}
              className="azm-btn flex items-center gap-2 bg-[#7C3AED] px-6 py-3.5 text-base font-semibold text-white hover:bg-[#8B5CF6] transition-colors azm-glow"
            >
              <Plus size={18} />
              {d.dashboard.newSessionCta}
            </button>
          </div>
        </div>
      </section>

      {/* Stats — mirrors brand component sheet */}
      <section aria-label={d.dashboard.weekTitle}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-azm-soft">
          <Sparkles size={16} className="text-azm-primary" />
          {d.dashboard.weekTitle}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<ShieldCheck size={15} />}
            label={d.dashboard.statSupportive}
            value={w?.approved ?? 0}
            color="#34D399"
          />
          <StatCard
            icon={<ShieldAlert size={15} />}
            label={d.dashboard.statDistracting}
            value={(w?.blocked ?? 0) + (w?.attempts ?? 0) === 0 ? 0 : w?.blocked ?? 0}
            color="#FB7185"
          />
          <StatCard
            icon={<HelpCircle size={15} />}
            label={d.dashboard.statUncertain}
            value={w?.uncertain ?? 0}
            color="#FBBF24"
          />
          <StatCard
            icon={<Zap size={15} />}
            label={d.dashboard.statInterventions}
            value={w?.attempts ?? 0}
            color="#8B5CF6"
          />
        </div>
      </section>

      {/* Recommended tools */}
      <ToolRecommends />

      {/* Groups */}
      <section>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-azm-soft">
          <Layers size={16} className="text-azm-primary" />
          {d.dashboard.groupsTitle}
        </div>
        <p className="mb-4 text-[13px] text-azm-muted">{d.dashboard.groupsSubtitle}</p>
        {store.groups.length === 0 ? (
          <div className="azm-card border-dashed p-8 text-center">
            <Layers size={28} className="mx-auto text-azm-muted/60" />
            <p className="mx-auto mt-3 max-w-md text-sm text-azm-muted">{d.dashboard.groupEmpty}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
