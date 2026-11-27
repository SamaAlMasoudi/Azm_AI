/* Azm brand tokens for JS-side usage (charts, SVG, orb states) */
export const AZM = {
  bg: "#0A0612",
  bg2: "#120A1F",
  primary: "#8B5CF6",
  strong: "#7C3AED",
  soft: "#C4B5FD",
  ink: "#EDE9FE",
  muted: "#A79BC8",
  ok: "#34D399",
  warn: "#FBBF24",
  bad: "#FB7185",
  info: "#60A5FA",
  idle: "#A78BFA",
} as const;

export const ORB_STATE_COLOR: Record<string, string> = {
  idle: AZM.idle,
  focused: AZM.ok,
  working: AZM.primary,
  alert: AZM.bad,
  break: AZM.info,
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
