/* Azm — session setup: goal, task, outcome, technique, personality, approved resources, groups */

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
    <section className="azm-card p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="azm-nums flex h-8 w-8 items-center justify-center rounded-xl border border-azm-primary/40 bg-azm-primary/10 text-sm font-bold text-azm-soft">
          {n}
        </span>
        <h2 className="flex items-center gap-2 text-base font-semibold text-azm-ink">
          <span className="text-azm-primary">{icon}</span>
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const FIELD =
  "azm-field w-full border border-white/10 bg-white/5 px-4 py-3 text-[15px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary focus:ring-2 focus:ring-azm-primary/30 transition";

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
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-azm-ink">{d.setup.title}</h1>
        <p className="mt-1 text-azm-muted">{d.setup.subtitle}</p>
        {editing && (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full border border-azm-warn/40 bg-azm-warn/10 px-3 py-1 text-xs font-medium text-azm-warn">
              {d.setup.editingFrom} {draft.name || "—"}
            </span>
            <button
              onClick={() => {
                store.cancelEditGroup();
                store.resetDraft();
              }}
              className="text-xs text-azm-muted underline-offset-2 hover:underline"
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
        <p className="mt-2 text-[13px] text-azm-muted">{d.setup.step1Hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-azm-muted">{d.setup.examples}:</span>
          {(lang === "ar"
            ? ["اختبار نهائي", "مشروع تخرج", "مساق Coursera"]
            : ["Final exam", "Graduation project", "Coursera course"]
          ).map((ex) => (
            <button
              key={ex}
              onClick={() => store.setDraft({ goal: draft.goal ? `${draft.goal} — ${ex}` : ex })}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-azm-soft hover:bg-white/10 transition-colors"
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
          className={`${FIELD} min-h-[72px] resize-y`}
          placeholder={d.setup.step2Placeholder}
          value={draft.task}
          onChange={(e) => store.setDraft({ task: e.target.value })}
        />
        <p className="mt-2 text-[13px] text-azm-muted">{d.setup.step2Hint}</p>
      </Section>

      {/* 3. Expected outcome */}
      <Section n={3} title={d.setup.step3} icon={<Flag size={17} />}>
        <label className="sr-only" htmlFor="outcome">
          {d.setup.step3}
        </label>
        <textarea
          id="outcome"
          className={`${FIELD} min-h-[72px] resize-y`}
          placeholder={d.setup.step3Placeholder}
          value={draft.expectedOutcome}
          onChange={(e) => store.setDraft({ expectedOutcome: e.target.value })}
        />
        <p className="mt-2 text-[13px] text-azm-muted">{d.setup.step3Hint}</p>
      </Section>

      {/* 4. Technique */}
      <Section n={4} title={d.setup.step4} icon={<Timer size={17} />}>
        <div className="grid gap-3 sm:grid-cols-3">
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
                onClick={() => chooseTechnique(t.id)}
                className={`azm-card azm-card-hover p-4 text-start transition-all ${
                  selected
                    ? "border-azm-primary bg-azm-primary/10 shadow-[0_0_24px_rgba(139,92,246,0.2)]"
                    : ""
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${selected ? "text-azm-soft" : "text-azm-ink"}`}>
                    {t.name}
                  </span>
                  <span
                    className={`h-4 w-4 rounded-full border-2 ${
                      selected ? "border-azm-primary bg-azm-primary" : "border-white/25"
                    }`}
                  />
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-azm-muted">{t.desc}</p>
              </button>
            );
          })}
        </div>
        {expandedTech && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-azm-muted" htmlFor="work">
                {d.setup.workMinutes}
              </label>
              <input
                id="work"
                type="number"
                min={5}
                max={120}
                className={`${FIELD} azm-nums`}
                value={draft.workMinutes}
                onChange={(e) =>
                  store.setDraft({ workMinutes: Math.max(5, Math.min(120, Number(e.target.value) || 5)) })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-azm-muted" htmlFor="brk">
                {d.setup.breakMinutes}
              </label>
              <input
                id="brk"
                type="number"
                min={3}
                max={30}
                className={`${FIELD} azm-nums`}
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
        <div className="grid gap-3 sm:grid-cols-3">
          {personalities.map((p) => {
            const selected = draft.personality === p.id;
            return (
              <button
                key={p.id}
                onClick={() => store.setDraft({ personality: p.id })}
                className={`azm-card azm-card-hover p-4 text-start transition-all ${
                  selected ? "border-azm-primary bg-azm-primary/10 shadow-[0_0_24px_rgba(139,92,246,0.2)]" : ""
                }`}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-2">
                  <span className={selected ? "text-azm-soft" : "text-azm-primary"}>{p.icon}</span>
                  <span className={`text-sm font-bold ${selected ? "text-azm-soft" : "text-azm-ink"}`}>
                    {p.name}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-azm-muted">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 6. Approved resources */}
      <Section n={6} title={d.setup.step6} icon={<Link2 size={17} />}>
        <div className="flex gap-2">
          <input
            className={FIELD}
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
            onClick={() => addUrl()}
            className="azm-btn flex shrink-0 items-center gap-1.5 border border-azm-primary/50 bg-azm-primary/15 px-4 py-3 text-sm font-semibold text-azm-soft hover:bg-azm-primary/25 transition-colors"
          >
            <Plus size={16} />
            {d.setup.addBtn}
          </button>
        </div>
        <p className="mt-2 text-[13px] text-azm-muted">{d.setup.step6Hint}</p>

        {draft.allowedSites.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {draft.allowedSites.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-full border border-azm-ok/30 bg-azm-ok/10 py-1.5 pe-2 ps-3 text-[13px] text-azm-ink"
              >
                <span className="text-azm-ok">{kindIcon(s.kind)}</span>
                <span className="max-w-[220px] truncate" dir="auto">
                  {s.label}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-azm-muted">
                  {kindLabel(s.kind)}
                </span>
                <button
                  onClick={() => removeSite(s.id)}
                  className="text-azm-muted hover:text-azm-bad transition-colors"
                  aria-label={d.setup.remove}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <span className="text-[12px] text-azm-muted">{d.setup.suggestions}:</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SETUP_SUGGESTIONS.map((sg) => (
              <button
                key={sg.url}
                onClick={() => addUrl(sg.url)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-azm-soft hover:border-azm-primary/50 hover:bg-azm-primary/10 transition-colors"
              >
                {sg.label[lang]}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Tools recommendation */}
      <ToolRecommends compact />

      {/* Launch */}
      <section className="azm-card azm-glow p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-medium text-azm-muted" htmlFor="gname">
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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                if (!draft.goal.trim() || !draft.task.trim() || !draft.expectedOutcome.trim()) {
                  toast.error(d.setup.needGoal);
                  return;
                }
                await store.saveGroup();
                if (!editing) store.resetDraft();
              }}
              className="azm-btn flex items-center gap-2 border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-azm-soft hover:bg-white/10 transition-colors"
            >
              <Save size={16} />
              {editing ? d.setup.updateGroupBtn : d.setup.saveGroupBtn}
            </button>
            <button
              onClick={async () => {
                if (!validateLaunch()) return;
                await store.startSession();
                store.resetDraft();
              }}
              className="azm-btn flex items-center gap-2 bg-[#7C3AED] px-7 py-3.5 text-base font-bold text-white hover:bg-[#8B5CF6] transition-colors azm-glow"
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
