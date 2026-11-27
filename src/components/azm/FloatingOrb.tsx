/* Azm — the Floating AI Orb: a draggable companion that lives above the app
 * while a session runs. In the web build it floats over the page; the Electron
 * build renders the same component in a transparent always-on-top window.
 * Click -> quick actions + free conversation with the agent. */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAzm } from "@/lib/azm/store";
import { getDict } from "@/lib/azm/i18n";
import { LEVELS } from "@/lib/azm/policy";
import type { OrbState } from "@/lib/azm/types";
import { formatClock } from "@/lib/azm/types";
import { Orb } from "./Orb";
import { Coffee, Loader2, X, Send } from "lucide-react";

const POS_KEY = "azm-orb-pos";

/** Orb bounding box (orb + optional timer chip below it). */
const ORB_W = 72;
const ORB_H = 96;
const PANEL_W = 320;
const PANEL_EST_H = 430;

interface Pos {
  x: number; // px from the RIGHT viewport edge — physical, direction-independent
  y: number; // px from the top
}

/** Keep the orb inside the current viewport. Applied on load, on drag, on
 *  resize and before persisting — a previously saved off-screen position
 *  (window resized, direction flipped, screen changed) can never stick. */
function clampOrbPos(p: Pos): Pos {
  if (typeof window === "undefined") return p;
  const maxX = Math.max(8, window.innerWidth - ORB_W);
  const maxY = Math.max(8, window.innerHeight - ORB_H);
  return { x: Math.min(maxX, Math.max(8, p.x)), y: Math.min(maxY, Math.max(8, p.y)) };
}

function readPos(): Pos {
  const fallback = clampOrbPos({ x: 24, y: 120 });
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Pos;
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return clampOrbPos(p);
    }
  } catch {
    /* default */
  }
  return fallback;
}

export function FloatingOrb() {
  const store = useAzm();
  const lang = store.lang;
  const d = getDict(lang);
  const active = store.active;
  const orbChat = store.orbChat;
  const [pos, setPos] = useState<Pos>({ x: 24, y: 120 });
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; target: "orb" | "panel" } | null>(null);
  const movedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setTickState] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPos(readPos()));
    return () => cancelAnimationFrame(id);
  }, []);

  // viewport shrunk (window resized / rotated / devtools opened): pull the
  // orb back inside so it can never end up permanently off-screen
  useEffect(() => {
    const onResize = () => setPos((p) => clampOrbPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // re-render every second while a session runs (countdown + state dot)
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTickState((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [active?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [orbChat.lines.length, orbChat.thinking]);

  const startDrag = useCallback(
    (e: React.PointerEvent, target: "orb" | "panel") => {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y, target };
      movedRef.current = false;
      setDragging(true);
    },
    [pos]
  );

  const onOrbPointerDown = useCallback((e: React.PointerEvent) => startDrag(e, "orb"), [startDrag]);

  // the chat panel header is draggable too — but its buttons stay clickable
  const onPanelPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      startDrag(e, "panel");
    },
    [startDrag]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true;
    // x = px from the RIGHT edge: dragging right (dx > 0) decreases it —
    // identical math in LTR and RTL, and always clamped to the viewport
    setPos(clampOrbPos({ x: dragRef.current.baseX - dx, y: dragRef.current.baseY + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const target = dragRef.current.target;
    dragRef.current = null;
    setDragging(false);
    if (movedRef.current) {
      setPos((p) => {
        const c = clampOrbPos(p);
        window.localStorage.setItem(POS_KEY, JSON.stringify(c));
        return c;
      });
    } else if (target === "orb") {
      store.openOrbChat();
    }
  }, [store]);

  // session protection + z-order root-cause fix: while an authorization
  // challenge or a dialogue owns the screen, the orb (fixed z-50, later in
  // the DOM) would paint ABOVE them and block the justification textarea /
  // modal fields. The orb steps aside; it returns — with its conversation —
  // as soon as the overlay closes.
  if (store.interception || store.dialog) return null;

  // the orb is a persistent companion: it stays available on EVERY tab
  // (dashboard, setup, session, summary, analytics, settings) — with or
  // without an active session — and never resets or loses its conversation
  // during navigation.

  const orbState: OrbState = store.interception
    ? "alert"
    : store.timerPhase === "break"
      ? "break"
      : !active
        ? "idle"
        : ["education", "reference", "ai_tool", "search"].includes(store.currentCategory)
          ? "working"
          : "focused";

  const lv = LEVELS[active?.level ?? "balanced"];
  const usedMin = active ? Math.round(active.breakUsedSeconds / 60) : 0;
  const budgetLeft = Math.max(0, lv.breakBudgetMin - usedMin);

  // the panel is 320px wide: clamp with ITS size (the orb clamp alone would
  // let most of the panel sit outside the viewport)
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const panelX = Math.max(8, Math.min(pos.x, vw - PANEL_W - 8));
  const panelY = Math.max(8, Math.min(pos.y, vh - PANEL_EST_H));

  return (
    <>
      {/* floating orb (hidden while the chat panel is open) */}
      {!orbChat.open && (
        <div
          className="fixed z-50 touch-none select-none"
          style={{ top: pos.y, right: pos.x, cursor: dragging ? "grabbing" : "grab" }}
          data-testid="floating-orb"
        >
          <button
            onPointerDown={onOrbPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex flex-col items-center gap-1.5"
            aria-label={d.orbChat.title}
          >
            <Orb state={orbState} size={58} />
            {active && store.timerPhase === "work" && (
              <span className="azm-nums rounded-full border border-white/15 bg-[#120A1F]/90 px-2 py-0.5 text-[11px] font-bold text-azm-soft shadow-lg" dir="ltr">
                {formatClock(store.secondsLeft)}
              </span>
            )}
          </button>
        </div>
      )}

      {/* quick-chat panel — translucent glass (balanced opacity: readable text,
       * the interface underneath stays subtly visible; utility classes are used
       * deliberately because the CSS pipeline drops the raw backdrop-filter
       * shorthand from custom rules) */}
      {orbChat.open && (
        <div
          className="azm-pop fixed z-50 flex w-[320px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border border-white/[0.14] bg-[#120A1F]/85 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md backdrop-saturate-[1.15]"
          style={{ top: panelY, right: panelX }}
          role="dialog"
          aria-label={d.orbChat.title}
          data-testid="orb-chat"
        >
          <div
            className="flex touch-none select-none items-center gap-2.5 border-b border-white/10 bg-transparent px-4 py-3"
            style={{ cursor: dragging ? "grabbing" : "grab" }}
            onPointerDown={onPanelPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            title={d.common.drag}
          >
            <Orb state={orbState} size={34} float={false} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-azm-ink">{d.orbChat.title}</p>
              <p className="truncate text-[10px] text-azm-muted">{d.orbChat.hint}</p>
            </div>
            <button
              onClick={store.closeOrbChat}
              className="rounded-lg p-1.5 text-azm-muted hover:bg-white/10 hover:text-azm-ink transition-colors"
              aria-label={d.common.close}
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-56 min-h-24 space-y-2.5 overflow-y-auto p-3">
            {orbChat.lines.length === 0 && (
              <p className="px-1 py-6 text-center text-[12px] leading-relaxed text-azm-muted">{d.orbChat.floatingHint}</p>
            )}
            {orbChat.lines.map((line, idx) => (
              <div key={idx} className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    line.role === "user" ? "bg-azm-primary/20 text-azm-ink" : "border border-white/10 bg-white/5 text-azm-ink"
                  }`}
                >
                  {line.text}
                </div>
              </div>
            ))}
            {orbChat.thinking && (
              <div className="flex items-center gap-2 px-1 py-1">
                <Loader2 size={16} className="animate-spin text-azm-primary" />
                <span className="text-[12px] text-azm-muted azm-breathe">{d.common.aiThinking}</span>
              </div>
            )}
          </div>

          {/* quick actions */}
          <div className="flex gap-2 border-t border-white/10 px-3 pt-2.5">
            <button
              onClick={() => {
                store.closeOrbChat();
                if (store.timerPhase !== "break") store.openDialog("break");
              }}
              disabled={!active || store.timerPhase === "break" || budgetLeft <= 0}
              className="azm-btn flex flex-1 items-center justify-center gap-1.5 border border-azm-info/40 bg-azm-info/10 px-2 py-2 text-[11px] font-bold text-azm-info hover:bg-azm-info/20 transition-colors disabled:opacity-35"
              title={budgetLeft <= 0 ? d.dialog.breakDenied : d.session.actionBreak}
            >
              <Coffee size={13} />
              {d.session.actionBreak} ({budgetLeft})
            </button>
            {active && (
              <span className="azm-nums flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[11px] font-bold text-azm-soft" dir="ltr">
                {formatClock(store.secondsLeft)}
              </span>
            )}
          </div>

          <form
            className="flex items-end gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              void store.sendOrbChat(text);
              setText("");
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (text.trim()) {
                    void store.sendOrbChat(text);
                    setText("");
                  }
                }
              }}
              placeholder={d.orbChat.placeholder}
              rows={1}
              className="azm-field max-h-24 min-h-[42px] flex-1 resize-none border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] text-azm-ink placeholder:text-azm-muted/60 outline-none focus:border-azm-primary focus:ring-2 focus:ring-azm-primary/30"
              aria-label={d.orbChat.placeholder}
            />
            <button
              type="submit"
              disabled={!text.trim() || orbChat.thinking}
              className="azm-btn flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#7C3AED] text-white hover:bg-[#8B5CF6] transition-colors disabled:opacity-40"
              aria-label={d.orbChat.title}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
