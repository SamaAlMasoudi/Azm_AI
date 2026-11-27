/* Azm — the Sabr tree: grows through 6 stages as real focus accumulates */

"use client";

import { AZM, hexToRgba } from "@/lib/azm/tokens";

const LEAF = AZM.ok;
const LEAF_DARK = "#10B981";
const BLOSSOM = AZM.soft;

export function SabrTree({ stage = 0, size = 220 }: { stage?: number; size?: number }) {
  const s = Math.max(0, Math.min(5, stage));
  const trunkH = [8, 22, 42, 64, 86, 104][s];
  const canopyR = [0, 8, 16, 26, 34, 40][s];
  const branches = s >= 3;

  return (
    <svg width={size} height={size} viewBox="0 0 220 220" fill="none" role="img" aria-label={`Sabr tree stage ${s}`}>
      <defs>
        <linearGradient id="azm-trunk" x1="110" y1="200" x2="110" y2="80">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <radialGradient id="azm-canopy" cx="40%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="60%" stopColor={LEAF} />
          <stop offset="100%" stopColor={LEAF_DARK} />
        </radialGradient>
        <radialGradient id="azm-hill" cx="50%" cy="20%" r="100%">
          <stop offset="0%" stopColor="#1E1233" />
          <stop offset="100%" stopColor="#120A1F" />
        </radialGradient>
      </defs>

      {/* hill */}
      <ellipse cx="110" cy="196" rx="78" ry="18" fill="url(#azm-hill)" />
      <ellipse cx="110" cy="194" rx="60" ry="10" fill="#0A0612" opacity="0.7" />

      {/* ground glow */}
      {s >= 2 && <ellipse cx="110" cy="193" rx="52" ry="9" fill={hexToRgba(AZM.primary, 0.18)} />}

      {/* trunk */}
      <path
        d={`M 104 194 C 104 ${194 - trunkH * 0.5}, 100 ${194 - trunkH * 0.7}, 110 ${194 - trunkH}`}
        stroke="url(#azm-trunk)"
        strokeWidth={2 + s * 1.2}
        strokeLinecap="round"
      />
      {branches && (
        <>
          <path d={`M 108 ${194 - trunkH * 0.55} C 96 ${194 - trunkH * 0.75}, 88 ${194 - trunkH * 0.85}, 82 ${194 - trunkH * 0.95}`} stroke="url(#azm-trunk)" strokeWidth={1.5 + s * 0.4} strokeLinecap="round" />
          <path d={`M 112 ${194 - trunkH * 0.6} C 124 ${194 - trunkH * 0.8}, 132 ${194 - trunkH * 0.88}, 138 ${194 - trunkH * 0.98}`} stroke="url(#azm-trunk)" strokeWidth={1.5 + s * 0.4} strokeLinecap="round" />
        </>
      )}

      {/* canopy */}
      {s >= 1 && canopyR > 0 && (
        <g>
          <circle cx={110} cy={194 - trunkH - canopyR * 0.5} r={canopyR} fill="url(#azm-canopy)" />
          {s >= 2 && (
            <circle cx={110 - canopyR * 0.7} cy={194 - trunkH - canopyR * 0.15} r={canopyR * 0.62} fill="url(#azm-canopy)" />
          )}
          {s >= 2 && (
            <circle cx={110 + canopyR * 0.7} cy={194 - trunkH - canopyR * 0.15} r={canopyR * 0.62} fill="url(#azm-canopy)" />
          )}
          {s >= 4 && (
            <circle cx={110} cy={194 - trunkH - canopyR * 1.05} r={canopyR * 0.5} fill="url(#azm-canopy)" />
          )}
          {/* blossoms at final stage */}
          {s === 5 && (
            <>
              <circle cx={96} cy={194 - trunkH - canopyR * 0.7} r={3.4} fill={BLOSSOM} />
              <circle cx={124} cy={194 - trunkH - canopyR * 0.9} r={3} fill={BLOSSOM} />
              <circle cx={110} cy={194 - trunkH - canopyR * 1.3} r={3.6} fill={BLOSSOM} />
              <circle cx={86} cy={194 - trunkH - canopyR * 0.2} r={2.6} fill={BLOSSOM} />
            </>
          )}
        </g>
      )}

      {/* seed stage: a small seed in the soil */}
      {s === 0 && (
        <>
          <ellipse cx="110" cy="190" rx="7" ry="5" fill="#7C3AED" />
          <ellipse cx="110" cy="188.6" rx="4.4" ry="2.8" fill="#A78BFA" />
        </>
      )}

      {/* sparkles at high stages */}
      {s >= 4 && (
        <g className="azm-breathe">
          <path d="M 40 60 L 41.6 64.4 L 46 66 L 41.6 67.6 L 40 72 L 38.4 67.6 L 34 66 L 38.4 64.4 Z" fill={AZM.idle} opacity="0.9" />
          <path d="M 180 74 L 181.4 77.8 L 185 79 L 181.4 80.2 L 180 84 L 178.6 80.2 L 175 79 L 178.6 77.8 Z" fill={AZM.soft} opacity="0.8" />
          <circle cx="58" cy="96" r="2" fill={AZM.primary} opacity="0.8" />
          <circle cx="168" cy="102" r="1.7" fill={AZM.ok} opacity="0.8" />
        </g>
      )}
    </svg>
  );
}
