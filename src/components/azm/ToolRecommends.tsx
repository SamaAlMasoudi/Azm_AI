/* Azm — AI-recommended complementary study tools */

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
    <section>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-azm-soft">
        <Sparkles size={16} className="text-azm-primary" />
        {d.dashboard.toolsTitle}
      </div>
      <p className="mb-4 text-[13px] text-azm-muted">{d.dashboard.toolsSubtitle}</p>
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        {RECOMMENDED_TOOLS.map((tool) => {
          const Icon = ICONS[tool.icon];
          const added = isAdded(tool.url);
          return (
            <div key={tool.id} className="azm-card azm-card-hover flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-azm-primary/30 bg-azm-primary/10 text-azm-soft">
                  <Icon size={17} />
                </span>
                <h3 className="text-sm font-semibold text-azm-ink">{tool.name[lang]}</h3>
              </div>
              <p className="text-[13px] leading-relaxed text-azm-muted">{tool.desc[lang]}</p>
              <button
                onClick={() => add(tool.url)}
                className={`azm-btn mt-auto flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-semibold transition-colors ${
                  added
                    ? "border border-azm-ok/40 bg-azm-ok/10 text-azm-ok"
                    : "border border-azm-primary/40 bg-azm-primary/10 text-azm-soft hover:bg-azm-primary/20"
                }`}
              >
                {added ? <Check size={14} /> : <Plus size={14} />}
                {added ? d.dashboard.toolAdded : d.dashboard.toolAdd}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
