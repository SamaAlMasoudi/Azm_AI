/* Azm — dashboard: synced with extension dashboard design */

"use client";

import { useEffect, useState } from "react";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { apiAnalytics } from "@/lib/azm/api";
import type { AnalyticsSummary, SessionGroupDTO } from "@/lib/azm/types";
import { ToolRecommends } from "./ToolRecommends";
import {
  Rocket,
  PlayCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  BarChart3,
  Folder,
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
    <div
className="flex items-center gap-3.5 rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] px-4 py-4 transition-colors hover:border-[#A79BC8]/30"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]"
        style={{
          color,
          backgroundColor: `${color}24`,
        }}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] text-[#A79BC8]">{label}</span>
        <span
          className="text-[32px] font-extrabold leading-tight tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
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
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-5 transition-colors hover:border-[#A79BC8]/34">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[#F4F0FC]">{group.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-[13.5px] text-[#A79BC8]">{group.goal}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => store.editGroup(group)}
            className="rounded-[10px] border border-[#A79BC8]/20 bg-[#1A1230] p-2 text-[#A79BC8] hover:text-[#F4F0FC] transition-colors"
            aria-label={d.common.edit}
            title={d.common.edit}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => void store.deleteGroup(group.id)}
            className="rounded-[10px] border border-[#FB7185]/35 bg-transparent p-2 text-[#FB7185] hover:bg-[#FB7185]/12 transition-colors"
            aria-label={d.common.delete}
            title={d.common.delete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#A78BFA]">
          {group.workMinutes} {d.dashboard.minutes} {d.dashboard.work} / {group.breakMinutes} {d.dashboard.breakWord}
        </span>
        <span className="rounded-full border border-[#A79BC8]/20 bg-[#241946] px-2.5 py-0.5 text-[12px] font-medium text-[#A79BC8]">
          {d.setup[group.personality === "strict" ? "strict" : group.personality === "friend" ? "friend" : "philosopher"]}
        </span>
        <span className="rounded-full border border-[#34D399]/35 bg-[#34D399]/12 px-2.5 py-0.5 text-[12px] font-semibold text-[#34D399]">
          {group.allowedSites.length} {d.dashboard.resourcesCount}
        </span>
      </div>

      <button
        onClick={() => void launch()}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#7C3AED] px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-[#8B5CF6] transition-colors"
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
    <div className="flex flex-col gap-7">
      {/* Hero — matching extension dashboard */}
      <section
        className="relative overflow-hidden rounded-[18px] border border-[#A79BC8]/34 px-7 py-8 md:px-8 md:py-9"
        style={{
          background:
            "radial-gradient(520px 260px at 100% 0%, rgba(124, 58, 237, 0.35), transparent 65%), linear-gradient(160deg, #1A1230, #130C22)",
        }}
      >
        <div className="flex flex-col items-start gap-3">
          <span className="inline-block rounded-full bg-[#8B5CF6]/16 px-3 py-1 text-[12.5px] font-bold text-[#A78BFA]">
            {lang === "ar" ? "جاهز للانطلاق" : "Ready to launch"}
          </span>

          <h1 className="text-[28px] md:text-[34px] font-extrabold leading-tight text-[#F4F0FC]">
            {d.dashboard.greeting}
          </h1>

          <p className="max-w-[540px] text-[16px] md:text-[17px] text-[#A79BC8] mb-1">
            {d.dashboard.greetingSub}
          </p>

          {savedHours > 0 && (
            <p className="text-base font-bold text-[#A78BFA]">
              {d.dashboard.statementSaved}{" "}
              <span className="text-2xl tabular-nums text-[#F4F0FC]">
                {savedHours.toFixed(1)}
              </span>{" "}
              {d.dashboard.statementHours}
            </p>
          )}

          <button
            onClick={() => {
              store.resetDraft();
              store.setView("setup");
            }}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#7C3AED] px-6 py-3 text-[16px] font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-[#8B5CF6] transition-colors"
          >
            <Rocket size={19} />
            <span>{lang === "ar" ? "بدء جلسة جديدة" : d.dashboard.newSessionCta}</span>
          </button>
        </div>
      </section>

      {/* Stats — This Week */}
      <section className="flex flex-col gap-3" aria-label={d.dashboard.weekTitle}>
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <BarChart3 size={20} className="text-[#A78BFA]" />
          <span>{d.dashboard.weekTitle}</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<CheckCircle2 size={22} />}
            label={d.dashboard.statSupportive}
            value={w?.approved ?? 0}
            color="#34D399"
          />
          <StatCard
            icon={<XCircle size={22} />}
            label={d.dashboard.statDistracting}
            value={(w?.blocked ?? 0) + (w?.attempts ?? 0) === 0 ? 0 : w?.blocked ?? 0}
            color="#FB7185"
          />
          <StatCard
            icon={<HelpCircle size={22} />}
            label={d.dashboard.statUncertain}
            value={w?.uncertain ?? 0}
            color="#FBBF24"
          />
          <StatCard
            icon={<ShieldAlert size={22} />}
            label={d.dashboard.statInterventions}
            value={w?.attempts ?? 0}
            color="#A78BFA"
          />
        </div>
      </section>

      {/* Recommended tools */}
      <ToolRecommends />

      {/* Session Groups */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <Folder size={20} className="text-[#A78BFA]" />
          <span>{d.dashboard.groupsTitle}</span>
        </h2>
        {store.groups.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#A79BC8]/34 bg-[#130C22] px-5 py-7 text-center text-sm text-[#A79BC8]">
            {d.dashboard.groupEmpty}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {store.groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}