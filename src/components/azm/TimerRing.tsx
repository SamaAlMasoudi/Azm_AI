/* Azm — timer ring: gradient #A78BFA -> #7C3AED, switches to #FB7185 when urgent (brand guide 04) */

"use client";

import { useId } from "react";
import type { TimerPhase } from "@/lib/azm/store";
import { formatClock } from "@/lib/azm/types";
import { AZM } from "@/lib/azm/tokens";

export function TimerRing({
  secondsLeft,
  totalSeconds,
  phase,
  size = 190,
  caption,
}: {
  secondsLeft: number;
  totalSeconds: number;
  phase: TimerPhase | "done";
  size?: number;
  caption: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const pct = Math.max(0, Math.min(1, totalSeconds > 0 ? secondsLeft / totalSeconds : 0));
  const urgent = phase === "work" && secondsLeft <= 120 && secondsLeft > 0;
  const colorA = phase === "break" ? AZM.info : urgent ? AZM.bad : AZM.idle;
  const colorB = phase === "break" ? "#3B82F6" : urgent ? AZM.bad : AZM.strong;
  const r = 84;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 200 200" className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${uid}`} x1="0" y1="0" x2="200" y2="200">
            <stop offset="0%" stopColor={colorA} />
            <stop offset="100%" stopColor={colorB} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="11" className="azm-ring-track" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          strokeWidth="11"
          stroke={`url(#ring-${uid})`}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className={`azm-nums font-bold text-4xl ${urgent ? "text-azm-bad" : "text-azm-ink"}`}>
          {formatClock(Math.max(0, secondsLeft))}
        </span>
        <span className="text-[13px] font-medium text-azm-muted">{caption}</span>
      </div>
    </div>
  );
}
