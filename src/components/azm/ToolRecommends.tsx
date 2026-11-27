/* Azm — AI-recommended complementary study tools: synced with extension design */

"use client";

import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { RECOMMENDED_TOOLS } from "@/lib/azm/sites-data";
import { parseResourceUrl } from "@/lib/azm/urls";
import { Bot, Sparkles, Search, BookOpen, Plus, Check } from "lucide-react";

const ICONS = {
  bot: Bot,
  sparkles: Sparkles,
  search: Search,
  book: BookOpen,
} as const;

const ICON_TONE: Record<keyof typeof ICONS, { color: string; bg: string }> = {
  bot: { color: "#34D399", bg: "rgba(52, 211, 153, 0.12)" },
  sparkles: { color: "#F59E6B", bg: "rgba(245, 158, 107, 0.12)" },
  search: { color: "#A78BFA", bg: "rgba(139, 92, 246, 0.16)" },
  book: { color: "#FBBF24", bg: "rgba(251, 191, 36, 0.12)" },
};

export function ToolRecommends({ compact = false }: { compact?: boolean }) {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);

  const isAdded = (url: string) =>
    store.draft.allowedSites.some((s) => {
      const parsed = parseResourceUrl(url);
      return parsed && s.pattern === parsed.pattern;
    });

  const add = (url: string) => {
    const parsed = parseResourceUrl(url);
    if (!parsed) return;
    if (store.draft.allowedSites.some((s) => s.pattern === parsed.pattern)) return;
    store.setDraft({
      allowedSites: [
        ...store.draft.allowedSites,
        {
          id: `${parsed.pattern}-${Date.now()}`,
          raw: url,
          pattern: parsed.pattern,
          kind: parsed.kind,
          label: parsed.label,
        },
      ],
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#F4F0FC]">
          <Sparkles size={20} className="text-[#A78BFA]" />
          <span>{d.dashboard.toolsTitle}</span>
        </h2>
        <p className="mt-1 text-[13.5px] text-[#A79BC8]">{d.dashboard.toolsSubtitle}</p>
      </div>

      <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {RECOMMENDED_TOOLS.map((tool) => {
          const Icon = ICONS[tool.icon];
          const tone = ICON_TONE[tool.icon];
          const added = isAdded(tool.url);
          const host = tool.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

          return (
            <div
              key={tool.id}
              className="flex flex-col gap-2.5 rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-4 transition-colors hover:border-[#A79BC8]/34"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
                  style={{ color: tone.color, backgroundColor: tone.bg }}
                >
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-[15.5px] font-bold leading-snug text-[#F4F0FC]">
                    {tool.name[lang]}
                  </h3>
                  <span className="block truncate text-[12px] text-[#A79BC8]" dir="ltr">
                    {host}
                  </span>
                </div>
              </div>

              <p className="flex-1 text-[13.5px] leading-relaxed text-[#A79BC8]">
                {tool.desc[lang]}
              </p>

              <button
                type="button"
                onClick={() => add(tool.url)}
                disabled={added}
                className={`mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border px-3.5 py-2 text-[13.5px] font-bold transition-colors ${
                  added
                    ? "border-[#34D399]/50 bg-[#34D399]/16 text-[#34D399] cursor-default"
                    : "border-[#A79BC8]/34 bg-transparent text-[#A78BFA] hover:bg-[#8B5CF6]/14"
                }`}
              >
                {added ? <Check size={15} /> : <Plus size={15} />}
                <span>{added ? d.dashboard.toolAdded : d.dashboard.toolAdd}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}