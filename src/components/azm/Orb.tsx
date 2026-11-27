/* Azm — the floating orb: Azm's face. Its glow color and dot tell the student their state (identity guide 04) */

"use client";

import { Logo } from "./Logo";
import type { OrbState } from "@/lib/azm/types";
import { ORB_STATE_COLOR, hexToRgba } from "@/lib/azm/tokens";

export function Orb({
  state = "idle",
  size = 76,
  dimmed = false,
  className = "",
  float = true,
}: {
  state?: OrbState;
  size?: number;
  dimmed?: boolean;
  className?: string;
  float?: boolean;
}) {
  const color = ORB_STATE_COLOR[state] ?? ORB_STATE_COLOR.idle;
  const isAlert = state === "alert";

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full ${
        isAlert ? "azm-shake" : float ? "azm-float" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
        opacity: dimmed ? 0.6 : 1,
        boxShadow: `0 0 ${Math.round(size * 0.55)}px ${hexToRgba(color, 0.28)}`,
        transition: "box-shadow 0.5s ease, opacity 0.5s ease",
      }}
      role="img"
      aria-label={`Azm orb: ${state}`}
    >
      {/* lavender disc behind the planet, per brand */}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: "linear-gradient(145deg, #F3EFFF 0%, #EDE9FE 55%, #DDD6FE 100%)",
          border: isAlert ? `2.5px solid ${color}` : "none",
        }}
      />
      <Logo size={Math.round(size * 0.8)} className="relative" />
      {/* state dot */}
      {!isAlert && (
        <span
          className="absolute rounded-full azm-breathe"
          style={{
            width: Math.max(9, size * 0.14),
            height: Math.max(9, size * 0.14),
            top: size * 0.04,
            insetInlineEnd: size * 0.04,
            background: color,
            boxShadow: `0 0 10px ${hexToRgba(color, 0.8)}`,
            border: "2px solid #F3EFFF",
          }}
        />
      )}
    </div>
  );
}

/** Compact orb for header chips */
export function OrbMini({ state = "idle", size = 30 }: { state?: OrbState; size?: number }) {
  return <Orb state={state} size={size} float={false} className="azm-float" />;
}
