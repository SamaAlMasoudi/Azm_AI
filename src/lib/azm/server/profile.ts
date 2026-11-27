/* Azm — server: profile resolution + secure pairing utilities.
 *
 * Every request is scoped to a Profile via the `x-azm-profile` header (the
 * profile code). Profiles isolate all data; the 8-char code doubles as a
 * recovery key so a student can move devices. The pairing token (separate,
 * longer) pairs the Chrome extension with this profile.
 */

import { db } from "@/lib/db";
import type { Profile } from "@prisma/client";
import { normalizeLevel } from "../policy";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

function randomCode(len: number): string {
  let out = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i]! % CODE_ALPHABET.length];
  return out;
}

function randomToken(): string {
  const buf = new Uint8Array(20);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** timing-safe string compare (both sides hex/uppercase — length check first). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function cleanCode(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? s : "";
}

export function cleanPairingToken(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(s) ? s : "";
}

/** Get the profile for a request, creating one when no valid code is given. */
export async function getOrCreateProfile(headerCode: unknown): Promise<Profile> {
  const code = cleanCode(headerCode);
  if (code) {
    const existing = await db.profile.findUnique({ where: { code } });
    if (existing) return existing;
  }
  return db.profile.create({
    data: {
      code: randomCode(8),
      pairingToken: randomToken(),
      interventionLevel: "balanced",
    },
  });
}

/** Resolve the profile behind an extension pairing token (or null). */
export async function profileByPairingToken(token: unknown): Promise<Profile | null> {
  const t = cleanPairingToken(token);
  if (!t) return null;
  const profile = await db.profile.findUnique({ where: { pairingToken: t } });
  return profile && safeEqual(t, profile.pairingToken) ? profile : null;
}

export async function regeneratePairingToken(profileId: string): Promise<string> {
  const token = randomToken();
  await db.profile.update({ where: { id: profileId }, data: { pairingToken: token } });
  return token;
}

/* --------------------------- simple rate limiting -------------------------- */

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

/* ------------------------------ sanitizers --------------------------------- */

export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Strip paste artifacts from an API key so a valid key is never stored or
 * sent in a form the provider would reject: zero-width characters, control
 * characters, ALL whitespace, a pasted "Bearer " prefix, and wrapping
 * quotes. The key is never echoed back to the UI by any caller.
 */
export function sanitizeApiKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let k = raw.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  k = k.replace(/^bearer\s+/i, "");
  k = k.replace(/[\u0000-\u001F\u007F\s]+/g, "");
  k = k.replace(/^["'`]+|["'`]+$/g, "");
  return k.slice(0, 300);
}

const MAX_URL = 2048;
const MAX_DOMAIN = 253;

export function isValidDomain(d: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d) && d.length <= MAX_DOMAIN;
}

export interface ActivityInput {
  url: string;
  domain: string;
  title: string;
  ts: number;
}

/** Validate + sanitize an activity event coming from the web app or extension. */
export function asActivity(raw: unknown): ActivityInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isStr(r.url, MAX_URL) || !isStr(r.title, 300)) return null;
  const domain = String(r.domain ?? "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!isValidDomain(domain)) return null;
  try {
    const u = new URL(String(r.url).includes("://") ? String(r.url) : `https://${String(r.url)}`);
    if (!/^https?:$/.test(u.protocol)) return null;
  } catch {
    return null;
  }
  const title = String(r.title).slice(0, 300).trim();
  return { url: String(r.url).slice(0, MAX_URL), domain, title, ts: Date.now() };
}

function isStr(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max && v.length > 0;
}

/* --------------------------- AI key vault ---------------------------------- */

/**
 * Per-provider API key vault. The active provider's key is mirrored into
 * `aiApiKey` so resolveProvider keeps working; the vault keeps the other
 * providers' keys so switching providers doesn't lose credentials.
 * Raw keys are NEVER returned to the UI — only previews.
 */
export function readKeyVault(p: Profile): Record<string, string> {
  try {
    const parsed = JSON.parse(p.aiKeysJson || "{}") as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    if (p.aiApiKey && !out[p.aiProvider]) out[p.aiProvider] = p.aiApiKey;
    return out;
  } catch {
    return p.aiApiKey ? { [p.aiProvider]: p.aiApiKey } : {};
  }
}

export function keyPreviewOf(key: string): string {
  if (!key) return "";
  return key.length <= 8 ? `${key.slice(0, 2)}…` : `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** Resolve the key for a provider: explicit input > vault > existing active key. */
export function resolveKeyFor(
  vault: Record<string, string>,
  providerId: string,
  explicitKey: string,
  currentActiveProvider: string,
  currentActiveKey: string
): string {
  const explicit = explicitKey.trim();
  if (explicit) return explicit;
  if (providerId === currentActiveProvider && currentActiveKey) return currentActiveKey;
  return vault[providerId] ?? "";
}

/** Safe AI settings reader for API responses (never leaks the raw key). */
export function publicAi(p: Profile) {
  const vault = readKeyVault(p);
  const keys: Record<string, { hasKey: boolean; keyPreview: string }> = {};
  for (const [provider, key] of Object.entries(vault)) {
    keys[provider] = { hasKey: key.length > 0, keyPreview: keyPreviewOf(key) };
  }
  return {
    provider: p.aiProvider,
    model: p.aiModel,
    baseUrl: p.aiBaseUrl,
    hasKey: p.aiApiKey.length > 0,
    keyPreview: p.aiApiKey ? keyPreviewOf(p.aiApiKey) : "",
    keys,
    challengeSeconds: p.challengeSeconds,
  };
}

export { normalizeLevel };
