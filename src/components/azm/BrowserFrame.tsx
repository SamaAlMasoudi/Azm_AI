/* Azm — simulated browser frame: chrome bar, address bar, scope bookmarks, mock site content */

"use client";

import { useMemo, useState } from "react";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { resolveDestination, isInScope, siteDisplayName } from "@/lib/azm/urls";
import { SITE_REGISTRY } from "@/lib/azm/sites-pages";
import { ArrowLeft, ArrowRight, RotateCw, Globe, Search, ShieldCheck } from "lucide-react";

export function BrowserFrame() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const active = store.active;
  const currentUrl = store.browserHistory[store.browserIdx] ?? "youtube.com";
  const dest = useMemo(() => resolveDestination(currentUrl), [currentUrl]);
  const [addressInput, setAddressInput] = useState("");

  if (!active) return null;

  const PageComp = SITE_REGISTRY[dest.siteId] ?? SITE_REGISTRY["unknown"];
  const inScope = isInScope(dest, active.allowedSites).allowed;
  const orbDim = ["education", "reference", "ai_tool", "search"].includes(dest.category) && inScope;

  const submitAddress = () => {
    const val = addressInput.trim();
    if (!val) return;
    const looksLikeUrl = /^[\w-]+(\.[\w-]+)+/.test(val.replace(/^https?:\/\//, "").split("/")[0]);
    if (looksLikeUrl) {
      store.browserNavigate(val.replace(/^https?:\/\//, ""), "address_bar");
    } else {
      store.browserSearch(val);
    }
    setAddressInput("");
  };

  return (
    <div className="azm-card overflow-hidden" dir="ltr">
      {/* chrome bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#120A1F] px-3 py-2.5">
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-[#FB7185]/70" />
          <span className="h-3 w-3 rounded-full bg-[#FBBF24]/70" />
          <span className="h-3 w-3 rounded-full bg-[#34D399]/70" />
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={store.browserBack}
            disabled={store.browserIdx <= 0}
            className="rounded-lg p-1.5 text-azm-muted hover:bg-white/10 hover:text-azm-ink disabled:opacity-30 transition-colors"
            aria-label={d.browser.back}
            title={d.browser.back}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={store.browserForward}
            disabled={store.browserIdx >= store.browserHistory.length - 1}
            className="rounded-lg p-1.5 text-azm-muted hover:bg-white/10 hover:text-azm-ink disabled:opacity-30 transition-colors"
            aria-label={d.browser.forward}
            title={d.browser.forward}
          >
            <ArrowRight size={16} />
          </button>
          <button
            onClick={store.browserReload}
            className="rounded-lg p-1.5 text-azm-muted hover:bg-white/10 hover:text-azm-ink transition-colors"
            aria-label={d.browser.reload}
            title={d.browser.reload}
          >
            <RotateCw size={15} />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5">
          <Globe size={14} className="shrink-0 text-azm-muted" />
          <input
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAddress();
            }}
            placeholder={dest.url}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-azm-ink placeholder:text-azm-muted outline-none"
            aria-label={d.browser.addressPlaceholder}
          />
          <Search
            size={14}
            className="shrink-0 cursor-pointer text-azm-muted hover:text-azm-soft"
            onClick={submitAddress}
          />
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-azm-warn/40 bg-azm-warn/10 px-2.5 py-1 text-[10px] font-medium text-azm-warn md:flex">
          <ShieldCheck size={11} />
          {d.meta.simulatedEnv}
        </span>
      </div>

      {/* scope bookmarks */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#0A0612] px-3 py-2 azm-scroll" dir={lang === "ar" ? "rtl" : "ltr"}>
        <span className="shrink-0 text-[11px] font-medium text-azm-muted">{d.session.bookmarksTitle}:</span>
        {active.allowedSites.map((s) => (
          <button
            key={s.id}
            onClick={() => store.browserNavigate(s.raw)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-azm-ok/30 bg-azm-ok/10 px-3 py-1 text-[12px] font-medium text-azm-ok hover:bg-azm-ok/20 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-azm-ok" />
            <span className="max-w-[180px] truncate" dir="auto">
              {s.label}
            </span>
          </button>
        ))}
        {active.allowedSites.length === 0 && (
          <span className="text-[11px] text-azm-muted">—</span>
        )}
      </div>

      {/* content */}
      <div className="relative h-[560px] md:h-[640px] overflow-hidden">
        <div
          className="h-full overflow-y-auto azm-scroll bg-white"
          aria-label={siteDisplayName(dest, lang)}
        >
          <PageComp
            lang={lang}
            dest={dest}
            navigate={(url) => store.browserNavigate(url, "link")}
          />
        </div>
        {/* dim veil while the working orb is dimmed? no — orb floats in the rail instead */}
      </div>
    </div>
  );
}
