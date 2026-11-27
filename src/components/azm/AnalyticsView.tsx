/* Azm — analytics: 100% exact match with Extentions/dashboard.html */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnalyticsSummary, Lang } from "@/lib/azm/types";
import { apiAnalytics } from "@/lib/azm/api";
import {
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-3.5 rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] px-[18px] py-4"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]"
        style={{ color, backgroundColor: `${color}24` }}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px] text-[#A79BC8]">{label}</span>
        <span
          className="text-[34px] font-extrabold leading-[1.1] tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export function AnalyticsView({ lang }: { lang: Lang }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiAnalytics();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const w = data?.week;
  const recent = data?.recent ?? [];

  return (
    <div dir="rtl" className="flex flex-col gap-[26px]">
      <header>
        <h1 className="text-[26px] font-extrabold leading-[1.3] text-[#F4F0FC]">الإحصاءات</h1>
        <p className="mt-1 text-[15px] text-[#A79BC8]">نظرة سريعة على تركيزك وتقدّمك.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <BarChart3 size={20} className="text-[#A78BFA]" />
          <span>هذا الأسبوع</span>
        </h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<CheckCircle2 size={22} />}
            label="أنشطة داعمة"
            value={w?.approved ?? 0}
            color="#34D399"
          />
          <StatCard
            icon={<XCircle size={22} />}
            label="أنشطة مشتتة"
            value={w?.blocked ?? 0}
            color="#FB7185"
          />
          <StatCard
            icon={<HelpCircle size={22} />}
            label="غير مؤكدة"
            value={w?.uncertain ?? 0}
            color="#FBBF24"
          />
          <StatCard
            icon={<ShieldAlert size={22} />}
            label="التدخلات"
            value={w?.attempts ?? 0}
            color="#A78BFA"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <Clock size={20} className="text-[#A78BFA]" />
          <span>سجل الجلسات</span>
        </h2>

        {loading ? (
          <div className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-6 text-center text-sm text-[#A79BC8]">
            جاري التحميل...
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#A79BC8]/34 bg-[#130C22] px-5 py-7 text-center text-sm text-[#A79BC8]">
            لا توجد جلسات مسجّلة بعد. ابدأ أول جلسة دراسة ليظهر سجلّك هنا.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {recent.map((iv) => (
              <div
                key={iv.id}
                className="flex flex-wrap items-center justify-between gap-3.5 rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] px-[18px] py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] bg-[#241946] text-[#A78BFA]">
                    <Clock size={20} />
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <strong className="truncate text-[16px] text-[#F4F0FC]">{iv.siteName}</strong>
                    <span className="truncate text-[13.5px] text-[#A79BC8]" dir="ltr">
                      {iv.siteUrl}
                    </span>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-bold ${
                    iv.verdict === "approved"
                      ? "bg-[#34D399]/12 text-[#34D399]"
                      : "bg-[#FBBF24]/12 text-[#FBBF24]"
                  }`}
                >
                  {iv.verdict === "approved" ? "مكتمل" : "تدخل"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}