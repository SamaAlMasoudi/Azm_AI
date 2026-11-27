/* Azm — brand logo: purple planet, glowing ring, white guiding star (identity guide 01) */

"use client";

export function Logo({
  size = 48,
  className = "",
  withGlow = false,
}: {
  size?: number;
  className?: string;
  withGlow?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      role="img"
      aria-label="Azm logo"
    >
      <defs>
        <radialGradient id="azm-sphere" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="35%" stopColor="#8B5CF6" />
          <stop offset="72%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#4C1D95" />
        </radialGradient>
        <radialGradient id="azm-sheen" cx="32%" cy="24%" r="40%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="azm-ring" x1="0" y1="0" x2="120" y2="0">
          <stop offset="0%" stopColor="#F3EFFF" />
          <stop offset="50%" stopColor="#EDE9FE" />
          <stop offset="100%" stopColor="#C4B5FD" />
        </linearGradient>
        <filter id="azm-logo-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#8B5CF6" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={withGlow ? "url(#azm-logo-glow)" : undefined}>
        {/* back half of the ring */}
        <g transform="rotate(-16 60 60)">
          <path d="M 14 60 A 46 13 0 0 1 106 60" stroke="url(#azm-ring)" strokeWidth="6" strokeLinecap="round" fill="none" />
        </g>
        {/* planet */}
        <circle cx="60" cy="60" r="30" fill="url(#azm-sphere)" />
        <circle cx="60" cy="60" r="30" fill="url(#azm-sheen)" />
        {/* subtle crescent shading */}
        <path d="M 78 42 A 30 30 0 0 1 78 78 A 34 34 0 0 0 78 42 Z" fill="#4C1D95" opacity="0.35" />
        {/* front half of the ring */}
        <g transform="rotate(-16 60 60)">
          <path d="M 14 60 A 46 13 0 0 0 106 60" stroke="url(#azm-ring)" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
        {/* guiding star */}
        <path
          d="M 78 33 L 80.8 40.7 L 88.5 43.5 L 80.8 46.3 L 78 54 L 75.2 46.3 L 67.5 43.5 L 75.2 40.7 Z"
          fill="#FFFFFF"
        />
        <circle cx="45" cy="36" r="1.7" fill="#FFFFFF" opacity="0.85" />
        <circle cx="88" cy="62" r="1.3" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
}

/** Circular badge wrapping the logo (used on dark surfaces, with purple glow) */
export function LogoBadge({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(145deg, #F3EFFF 0%, #EDE9FE 55%, #DDD6FE 100%)",
        boxShadow: "0 0 40px rgba(139, 92, 246, 0.25)",
      }}
    >
      <Logo size={Math.round(size * 0.78)} />
    </span>
  );
}

/** The circular "ع" mark used inside the app next to the name (brand: الشارة) */
export function AzmAIBadge({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full font-bold text-white select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: "linear-gradient(140deg, #8B5CF6 0%, #7C3AED 100%)",
        boxShadow: "0 0 24px rgba(139, 92, 246, 0.35)",
      }}
      aria-hidden
    >
      ع
    </span>
  );
}
