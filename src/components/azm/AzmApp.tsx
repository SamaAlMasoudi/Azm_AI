/* Azm — app shell: header, nav, view router, footer */

"use client";

import { useEffect } from "react";
import { useAzm, type View } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { formatClock } from "@/lib/azm/types";
import { LogoBadge, AzmAIBadge } from "./Logo";
import { OrbMini } from "./Orb";
import { FloatingOrb } from "./FloatingOrb";
import { Dashboard } from "./Dashboard";
import { SetupWizard } from "./SetupWizard";
import { ActiveSessionView } from "./ActiveSessionView";
import { SessionSummary } from "./SessionSummary";
import { AnalyticsView } from "./AnalyticsView";
import { SettingsView } from "./SettingsView";
import { DialogueModal } from "./DialogueModal";
import { Home, BarChart3, Settings, Languages, Plus } from "lucide-react";

function NavButton({ view, active, icon, label, onClick }: {
  view: View;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-[#241946] text-[#A78BFA]"
          : "text-[#A79BC8] hover:text-[#F4F0FC]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AzmApp() {
  const store = useAzm();
  const { lang, view, active, timerPhase, secondsLeft } = store;
  const d = getDict(lang);
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    void store.bootstrap();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => useAzm.getState().tick(), 1000);
    return () => clearInterval(t);
  }, [active?.id]);

  useEffect(() => {
    const onHide = () => useAzm.getState().syncNow();
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    if (view === "dashboard" || view === "setup") void store.loadGroups();
  }, [view]);

  const navItems: { v: View; icon: React.ReactNode; label: string }[] = [
    { v: "dashboard", icon: <Home size={16} />, label: d.nav.dashboard },
    { v: "analytics", icon: <BarChart3 size={16} />, label: d.nav.analytics },
    { v: "settings", icon: <Settings size={16} />, label: d.nav.settings },
  ];

  return (
    <div
      dir={dir}
      className="min-h-screen flex flex-col text-[#F4F0FC]"
      style={{
        fontFamily:
          "var(--font-plex-arabic), 'Segoe UI', 'Noto Sans Arabic', Tahoma, system-ui, sans-serif",
        background:
          "radial-gradient(900px 420px at 85% -10%, rgba(124, 58, 237, 0.22), transparent 60%), radial-gradient(700px 380px at 5% 0%, rgba(139, 92, 246, 0.12), transparent 60%), #0A0612",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Floating Topbar matching Extension Dashboard */}
      <div className="sticky top-0 z-40 w-full max-w-[1080px] mx-auto px-4 pt-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#A79BC8]/20 bg-[#130C22]/85 px-4 py-3 backdrop-blur-md">
          {/* Brand */}
          <button
            className="flex min-w-0 shrink-0 items-center gap-3 group"
            onClick={() => store.setView(active ? "session" : "dashboard")}
            aria-label={d.meta.appName}
          >
            <LogoBadge size={44} />
            <span className="text-start leading-tight">
              <span className="block text-[17px] font-extrabold tracking-wide text-[#F4F0FC]" dir="ltr">
                AZM AI
              </span>
              <span className="block text-[12.5px] text-[#A79BC8]">{d.meta.tagline}</span>
            </span>
          </button>

          {/* Pill Navigation Tabs */}
          <nav
            className="flex items-center gap-1 rounded-full border border-[#A79BC8]/20 bg-[#1A1230] p-1"
            aria-label="Main"
          >
            {navItems.map((item) => (
              <NavButton
                key={item.v}
                view={item.v}
                active={view === item.v}
                icon={item.icon}
                label={item.label}
                onClick={() => store.setView(item.v)}
              />
            ))}
          </nav>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            {active && view !== "session" && (
              <button
                onClick={() => store.setView("session")}
                className="flex items-center gap-2 rounded-xl border border-[#34D399]/40 bg-[#34D399]/10 px-3 py-2 text-sm font-semibold text-[#34D399] hover:bg-[#34D399]/20 transition-colors"
              >
                <OrbMini state={timerPhase === "break" ? "break" : "focused"} size={20} />
                <span className="tabular-nums">{formatClock(secondsLeft)}</span>
              </button>
            )}

            <button
              onClick={() => store.setView("setup")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                view === "setup"
                  ? "border border-[#A79BC8]/35 bg-[#241946] text-[#A78BFA]"
                  : "bg-[#7C3AED] text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] hover:bg-[#8B5CF6]"
              }`}
            >
              <Plus size={16} />
              <span>{lang === "ar" ? "جلسة دراسة جديدة" : "New Session"}</span>
            </button>

            <button
              onClick={() => store.setLang(lang === "ar" ? "en" : "ar")}
              className="inline-flex items-center gap-1 rounded-xl border border-[#A79BC8]/20 bg-transparent px-2.5 py-2 text-xs font-semibold text-[#A79BC8] hover:bg-[#1A1230] hover:text-[#F4F0FC] transition-colors"
              aria-label="Switch language"
              title="Switch language"
            >
              <Languages size={15} />
              <span dir="ltr">{d.meta.langToggle}</span>
            </button>
          </div>
        </header>
      </div>

      {/* Main */}
      <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 py-6 azm-rise">
        {view === "dashboard" && <Dashboard />}
        {view === "setup" && <SetupWizard />}
        {view === "session" && <ActiveSessionView />}
        {view === "summary" && <SessionSummary />}
        {view === "analytics" && <AnalyticsView lang={lang} />}
        {view === "settings" && <SettingsView />}
        <DialogueModal />
      </main>

      {/* floating AI orb */}
      <FloatingOrb />

      {/* Footer */}
      <footer className="mt-auto w-full max-w-[1080px] mx-auto px-4 pb-7 pt-6">
        <div className="flex flex-col items-center gap-3 border-t border-[#A79BC8]/15 pt-5 text-center">
          <div className="flex items-center gap-2.5">
            <AzmAIBadge size={34} />
            <div className="text-start leading-tight">
              <span className="block text-sm font-bold text-[#F4F0FC]" dir="ltr">
                AZM AI
              </span>
              <span className="block text-[12px] text-[#A79BC8]">{d.meta.tagline}</span>
            </div>
          </div>
          <p className="text-[12.5px] text-[#A79BC8]">
            {d.meta.simulatedEnv} · {d.settings.version}
          </p>
        </div>
      </footer>
    </div>
  );
}