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
import { LayoutDashboard, PlayCircle, BarChart3, Settings, Languages } from "lucide-react";

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
      className={`flex shrink-0 items-center gap-2 azm-btn px-3 md:px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[#7C3AED] text-white shadow-[0_0_24px_rgba(139,92,246,0.35)]"
          : "text-azm-muted hover:text-azm-ink hover:bg-white/5 border border-transparent"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
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

  // session heartbeat lives in the app shell (not the session view): the
  // countdown, nudges and server sync keep running while the student is on
  // ANY tab — analytics, settings, dashboard — instead of freezing the
  // active session the moment they navigate away from it
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => useAzm.getState().tick(), 1000);
    return () => clearInterval(t);
  }, [active?.id]);

  // session protection: flush state to the server (and keep the session
  // resumable) no matter which tab is open when the tab is hidden or closed
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

  // Load groups when relevant
  useEffect(() => {
    if (view === "dashboard" || view === "setup") void store.loadGroups();
     
  }, [view]);

  const navItems: { v: View; icon: React.ReactNode; label: string }[] = [
    { v: "dashboard", icon: <LayoutDashboard size={17} />, label: d.nav.dashboard },
    { v: "analytics", icon: <BarChart3 size={17} />, label: d.nav.analytics },
    { v: "settings", icon: <Settings size={17} />, label: d.nav.settings },
  ];

  return (
    <div
      dir={dir}
      className="min-h-screen flex flex-col bg-[#0A0612] text-[#EDE9FE] azm-ambient"
      style={{
        fontFamily:
          "var(--font-plex-arabic), 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0612]/90">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <button
            className="flex min-w-0 shrink-0 items-center gap-3 group"
            onClick={() => store.setView(active ? "session" : "dashboard")}
            aria-label={d.meta.appName}
          >
            <LogoBadge size={42} />
            <span className="text-start leading-tight">
              <span className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-azm-ink">{d.meta.appName}</span>
                <span className="text-[11px] font-semibold tracking-[0.25em] text-azm-primary" dir="ltr">
                  AZM AI
                </span>
              </span>
              <span className="block text-[11px] text-azm-muted">{d.meta.tagline}</span>
            </span>
          </button>

          <nav
            className="ms-auto flex max-w-[62vw] items-center gap-1.5 overflow-x-auto sm:max-w-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Main"
          >
            {active && view !== "session" && (
              <button
                onClick={() => store.setView("session")}
                className="flex items-center gap-2 azm-btn px-3 py-2 text-sm font-medium border border-azm-ok/40 bg-azm-ok/10 text-azm-ok hover:bg-azm-ok/15 transition-colors"
              >
                <OrbMini state={timerPhase === "break" ? "break" : "focused"} size={22} />
                <span className="azm-nums">{formatClock(secondsLeft)}</span>
                <span className="hidden md:inline">{d.nav.activeBadge}</span>
              </button>
            )}
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
            <button
              onClick={() => store.setLang(lang === "ar" ? "en" : "ar")}
              className="azm-btn flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-azm-soft hover:bg-white/10 transition-colors"
              aria-label="Switch language"
            >
              <Languages size={16} />
              <span dir="ltr">{d.meta.langToggle}</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 md:py-8 azm-rise">
        {view === "dashboard" && <Dashboard />}
        {view === "setup" && <SetupWizard />}
        {view === "session" && <ActiveSessionView />}
        {view === "summary" && <SessionSummary />}
        {view === "analytics" && <AnalyticsView lang={lang} />}
        {view === "settings" && <SettingsView />}
      <DialogueModal />
      </main>

      {/* floating AI orb (draggable, quick chat) */}
      <FloatingOrb />

      {/* Footer — sticks to bottom via flex + mt-auto */}
      <footer className="mt-auto border-t border-white/10 bg-[#0A0612]">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <AzmAIBadge size={30} />
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-azm-soft" dir="ltr">
                AZM AI
              </span>
              <span className="block text-[11px] text-azm-muted">{d.meta.tagline}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-azm-muted">
            <span>{d.meta.simulatedEnv}</span>
            <span aria-hidden>·</span>
            <span>{d.settings.version}</span>
            <span aria-hidden>·</span>
            <button
              className="hover:text-azm-soft underline-offset-2 hover:underline"
              onClick={() => store.setView("settings")}
            >
              {d.nav.settings}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
