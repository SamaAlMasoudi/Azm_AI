/* Azm — session setup: synced with extension dashboard design */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { parseResourceUrl } from "@/lib/azm/urls";
import { SETUP_SUGGESTIONS } from "@/lib/azm/sites-data";
import type { Personality, TechniqueId } from "@/lib/azm/types";
import { TECHNIQUE_PRESETS } from "@/lib/azm/types";
import { ToolRecommends } from "./ToolRecommends";
import {
  Target,
  ListChecks,
  Flag,
  Timer,
  VenetianMask,
  Link2,
  Youtube,
  Globe,
  ListVideo,
  UserRound,
  AtSign,
  Plus,
  Rocket,
  Save,
  X,
  Lightbulb,
} from "lucide-react";

function Section({
  n,
  title,
  icon,
  children,
}: {
  n: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-extrabold text-white tabular-nums">
          {n}
        </span>
        <h2 className="flex items-center gap-2 text-[16.5px] font-bold text-[#F4F0FC]">
          <span className="text-[#A78BFA]">{icon}</span>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const FIELD =
  "w-full rounded-[12px] border border-[#A79BC8]/34 bg-[#1A1230] px-3.5 py-2.5 text-[15px] text-[#F4F0FC] placeholder:text-[#A79BC8]/65 outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/25 transition";

export function SetupWizard() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const draft = store.draft;
  const [urlInput, setUrlInput] = useState("");
  const [expandedTech, setExpandedTech] = useState(draft.technique === "custom");

  const editing = store.editingGroupId;

  const addUrl = (raw?: string) => {
    const input = (raw ?? urlInput).trim();
    if (!input) return;
    const parsed = parseResourceUrl(input);
    if (!parsed) {
      toast.error(d.setup.invalidUrl);
      return;
    }
    if (draft.allowedSites.some((s) => s.pattern === parsed.pattern)) {
      toast.info(d.setup.alreadyAdded);
      return;
    }
    store.setDraft({
      allowedSites: [
        ...draft.allowedSites,
        {
          id: `${parsed.pattern}-${Date.now()}`,
          raw: input,
          pattern: parsed.pattern,
          kind: parsed.kind,
          label: parsed.label,
        },
      ],
    });
    setUrlInput("");
  };

  const removeSite = (id: string) => {
    store.setDraft({ allowedSites: draft.allowedSites.filter((s) => s.id !== id) });
  };

  const chooseTechnique = (t: TechniqueId) => {
    if (t === "custom") {
      setExpandedTech(true);
      store.setDraft({ technique: "custom" });
    } else {
      const p = TECHNIQUE_PRESETS[t];
      store.setDraft({ technique: t, workMinutes: p.work, breakMinutes: p.break });
      setExpandedTech(false);
    }
  };

  const personalities: { id: Personality; name: string; desc: string; icon: React.ReactNode }[] = [
    { id: "strict", name: d.setup.strict, desc: d.setup.strictDesc, icon: <VenetianMask size={18} /> },
    { id: "friend", name: d.setup.friend, desc: d.setup.friendDesc, icon: <UserRound size={18} /> },
    { id: "philosopher", name: d.setup.philosopher, desc: d.setup.philosopherDesc, icon: <Lightbulb size={18} /> },
  ];

  const kindIcon = (kind: string) => {
    switch (kind) {
      case "video":
        return <Youtube size={14} />;
      case "channel":
        return <AtSign size={14} />;
      case "playlist":
        return <ListVideo size={14} />;
      case "domain":
        return <Globe size={14} />;
      default:
        return <Link2 size={14} />;
    }
  };

  const kindLabel = (kind: string) => {
    switch (kind) {
      case "video":
        return d.setup.kindVideo;
      case "channel":
        return d.setup.kindChannel;
      case "playlist":
        return d.setup.kindPlaylist;
      case "domain":
        return d.setup.kindDomain;
      default:
        return d.setup.kindUrl;
    }
  };

  const validateLaunch = (): boolean => {
    if (!draft.goal.trim()) {
      toast.error(d.setup.needGoal);
      return false;
    }
    if (!draft.task.trim()) {
      toast.error(d.setup.needTask);
      return false;
    }
    if (!draft.expectedOutcome.trim()) {
      toast.error(d.setup.needOutcome);
      return false;
    }
    if (draft.allowedSites.length === 0) {
      toast.error(d.setup.needResource);
      return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="mb-1">
        <h1 className="text-[26px] font-extrabold leading-snug text-[#F4F0FC]">{d.setup.title}</h1>
        <p className="mt-1 text-[15px] text-[#A79BC8]">{d.setup.subtitle}</p>
        {editing && (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border border-[#FBBF24]/40 bg-[#FBBF24]/10 px-3 py-1 text-xs font-semibold text-[#FBBF24]">
              {d.setup.editingFrom} {draft.name || "—"}
            </span>
            <button
              onClick={() => {
                store.cancelEditGroup();
                store.resetDraft();
              }}
              className="text-xs text-[#A79BC8] underline-offset-2 hover:text-[#F4F0FC] hover:underline"
            >
              {d.setup.cancelEdit}
            </button>
          </div>
        )}
      </header>

      {/* 1. Goal */}
      <Section n={1} title={d.setup.step1} icon={<Target size={17} />}>
        <label className="sr-only" htmlFor="goal">
          {d.setup.step1}
        </label>
        <input
          id="goal"
          className={FIELD}
          placeholder={d.setup.step1Placeholder}
          value={draft.goal}
          onChange={(e) => store.setDraft({ goal: e.target.value })}
        />
        <p className="mt-2 text-[13px] text-[#A79BC8]">{d.setup.step1Hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-[#A79BC8]">{d.setup.examples}:</span>
          {(lang === "ar"
            ? ["مسار Coursera", "مشروع تخرج", "اختبار نهائي"]
            : ["Coursera course", "Graduation project", "Final exam"]
          ).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => store.setDraft({ goal: draft.goal ? `${draft.goal} — ${ex}` : ex })}
              className="rounded-full border border-[#A79BC8]/34 bg-[#1A1230] px-3.5 py-1 text-[13px] text-[#A79BC8] hover:border-[#A78BFA] hover:bg-[#241946] hover:text-[#F4F0FC] transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </Section>

      {/* 2. Task */}
      <Section n={2} title={d.setup.step2} icon={<ListChecks size={17} />}>
        <label className="sr-only" htmlFor="task">
          {d.setup.step2}
        </label>
        <textarea
          id="task"
          className={`${FIELD} min-h-[76px] resize-y`}
          placeholder={d.setup.step2Placeholder}
          value={draft.task}
          onChange={(e) => store.setDraft({ task: e.target.value })}
        />
        <p className="mt-2 text-[13px] text-[#A79BC8]">{d.setup.step2Hint}</p>
      </Section>

      {/* 3. Expected outcome */}
      <Section n={3} title={d.setup.step3} icon={<Flag size={17} />}>
        <label className="sr-only" htmlFor="outcome">
          {d.setup.step3}
        </label>
        <textarea
          id="outcome"
          className={`${FIELD} min-h-[84px] resize-y`}
          placeholder={d.setup.step3Placeholder}
          value={draft.expectedOutcome}
          onChange={(e) => store.setDraft({ expectedOutcome: e.target.value })}
        />
        <p className="mt-2 text-[13px] text-[#A79BC8]">{d.setup.step3Hint}</p>
      </Section>

      {/* 4. Technique */}
      <Section n={4} title={d.setup.step4} icon={<Timer size={17} />}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(
            [
              { id: "pomodoro", name: d.setup.pomodoro, desc: d.setup.pomodoroDesc },
              { id: "5217", name: d.setup.t5217, desc: d.setup.t5217Desc },
              { id: "custom", name: d.setup.custom, desc: d.setup.customDesc },
            ] as { id: TechniqueId; name: string; desc: string }[]
          ).map((t) => {
            const selected = draft.technique === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseTechnique(t.id)}
                className={`rounded-[12px] border p-4 text-start transition-all ${
                  selected
                    ? "border-[#8B5CF6] bg-[#7C3AED]/18 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]"
                    : "border-[#A79BC8]/34 bg-[#1A1230] hover:border-[#A78BFA]"
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#F4F0FC]">{t.name}</span>
                  <span
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                      selected ? "border-[#8B5CF6] bg-[#7C3AED]" : "border-[#A79BC8]/40"
                    }`}
                  />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#A79BC8]">{t.desc}</p>
              </button>
            );
          })}
        </div>

        {expandedTech && (
          <div className="mt-3.5 grid gap-3 rounded-[12px] border border-[#A79BC8]/16 bg-[#1A1230] p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13.5px] font-bold text-[#F4F0FC]" htmlFor="work">
                {d.setup.workMinutes}
              </label>
              <input
                id="work"
                type="number"
                min={5}
                max={120}
                className={`${FIELD} tabular-nums font-bold`}
                value={draft.workMinutes}
                onChange={(e) =>
                  store.setDraft({ workMinutes: Math.max(5, Math.min(120, Number(e.target.value) || 5)) })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13.5px] font-bold text-[#F4F0FC]" htmlFor="brk">
                {d.setup.breakMinutes}
              </label>
              <input
                id="brk"
                type="number"
                min={3}
                max={30}
                className={`${FIELD} tabular-nums font-bold`}
                value={draft.breakMinutes}
                onChange={(e) =>
                  store.setDraft({ breakMinutes: Math.max(3, Math.min(30, Number(e.target.value) || 5)) })
                }
              />
            </div>
          </div>
        )}
      </Section>

      {/* 5. Personality */}
      <Section n={5} title={d.setup.step5} icon={<VenetianMask size={17} />}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {personalities.map((p) => {
            const selected = draft.personality === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => store.setDraft({ personality: p.id })}
                className={`rounded-[12px] border p-4 text-start transition-all ${
                  selected
                    ? "border-[#8B5CF6] bg-[#7C3AED]/18 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]"
                    : "border-[#A79BC8]/34 bg-[#1A1230] hover:border-[#A78BFA]"
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#A78BFA]">{p.icon}</span>
                  <span className="text-sm font-bold text-[#F4F0FC]">{p.name}</span>
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#A79BC8]">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 6. Approved resources */}
      <Section n={6} title={d.setup.step6} icon={<Link2 size={17} />}>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${FIELD} flex-1 min-w-[220px]`}
            placeholder={d.setup.urlPlaceholder}
            value={urlInput}
            dir="ltr"
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <button
            type="button"
            onClick={() => addUrl()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[12px] border border-[#A79BC8]/34 bg-transparent px-4 py-2.5 text-sm font-bold text-[#A78BFA] hover:bg-[#8B5CF6]/14 transition-colors"
          >
            <Plus size={16} />
            {d.setup.addBtn}
          </button>
        </div>
        <p className="mt-2 text-[13px] text-[#A79BC8]">{d.setup.step6Hint}</p>

        {draft.allowedSites.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {draft.allowedSites.map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/14 py-1 pe-2 ps-3 text-[13.5px] text-[#F4F0FC]"
              >
                <span className="text-[#A78BFA]">{kindIcon(s.kind)}</span>
                <span className="max-w-[220px] truncate text-[#A78BFA]" dir="auto">
                  {s.label}
                </span>
                <span className="rounded-full bg-[#241946] px-2 py-0.5 text-[10.5px] text-[#A79BC8]">
                  {kindLabel(s.kind)}
                </span>
                <button
                  type="button"
                  onClick={() => removeSite(s.id)}
                  className="grid h-5 w-5 place-items-center rounded-full text-[#A79BC8] hover:bg-[#FB7185]/20 hover:text-[#FB7185] transition-colors"
                  aria-label={d.setup.remove}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <span className="text-[12.5px] text-[#A79BC8]">{d.setup.suggestions}:</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SETUP_SUGGESTIONS.map((sg) => (
              <button
                key={sg.url}
                type="button"
                onClick={() => addUrl(sg.url)}
                className="rounded-full border border-[#A79BC8]/34 bg-[#1A1230] px-3.5 py-1.5 text-[13px] text-[#A79BC8] hover:border-[#A78BFA] hover:bg-[#241946] hover:text-[#F4F0FC] transition-colors"
              >
                {sg.label[lang]}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Tools recommendation */}
      <ToolRecommends compact />

      {/* Launch & Save Group */}
      <section className="rounded-[18px] border border-[#8B5CF6]/50 bg-[#130C22] p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13.5px] font-bold text-[#F4F0FC]" htmlFor="gname">
              {d.setup.groupNameLabel}
            </label>
            <input
              id="gname"
              className={FIELD}
              placeholder={d.setup.groupNamePlaceholder}
              value={draft.name}
              onChange={(e) => store.setDraft({ name: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={async () => {
                if (!draft.goal.trim() || !draft.task.trim() || !draft.expectedOutcome.trim()) {
                  toast.error(d.setup.needGoal);
                  return;
                }
                await store.saveGroup();
                if (!editing) store.resetDraft();
              }}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[#A79BC8]/34 bg-transparent px-5 py-3 text-sm font-bold text-[#A78BFA] hover:bg-[#8B5CF6]/14 transition-colors"
            >
              <Save size={17} />
              {editing ? d.setup.updateGroupBtn : d.setup.saveGroupBtn}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!validateLaunch()) return;
                await store.startSession();
                store.resetDraft();
              }}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#7C3AED] px-6 py-3 text-[16px] font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-[#8B5CF6] transition-colors"
            >
              <Rocket size={18} />
              {d.setup.launchBtn}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}