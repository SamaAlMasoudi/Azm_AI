/* Azm — URL parsing, destination resolution, and scope matching */

import type { NavDestination, ScopeEntry, ScopeKind } from "./types";
import { SITE_CATALOG, type CatalogVideo } from "./sites-data";

const YT_HOSTS = ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"];

export function normalizeUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^www\./i, "");
  s = s.replace(/\/+$/, "");
  return s.toLowerCase();
}

function safeUrl(raw: string): URL | null {
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto);
  } catch {
    return null;
  }
}

export interface ParsedResource {
  kind: ScopeKind;
  pattern: string;
  label: string;
  ok: boolean;
}

function guessLabel(host: string): string {
  const known = SITE_CATALOG.find(
    (s) => host.endsWith(s.host) || s.host.endsWith(host)
  );
  return known ? known.name.ar : host;
}

/** Parse a user-provided URL into a scope entry. */
export function parseResourceUrl(raw: string): ParsedResource | null {
  const input = raw.trim();
  if (!input) return null;
  const u = safeUrl(input);
  if (!u) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const norm = normalizeUrl(input);

  if (YT_HOSTS.includes(host) || YT_HOSTS.includes(`${host}`)) {
    // youtu.be short links
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id && id.length >= 5) {
        return { kind: "video", pattern: `yt:video:${id}`, label: `فيديو · ${id}`, ok: true };
      }
    }
    const v = u.searchParams.get("v");
    const list = u.searchParams.get("list");
    const channelMatch = u.pathname.match(/^\/(@[\w\u0600-\u06FF.-]+)/);
    if (v && v.length >= 5) {
      return { kind: "video", pattern: `yt:video:${v}`, label: `فيديو · ${v}`, ok: true };
    }
    if (channelMatch) {
      const ch = channelMatch[1];
      return { kind: "channel", pattern: `yt:channel:${ch}`, label: `قناة · ${ch}`, ok: true };
    }
    if (list) {
      return { kind: "playlist", pattern: `yt:playlist:${list}`, label: `قائمة تشغيل · ${list}`, ok: true };
    }
    if (u.pathname.startsWith("/watch")) {
      return { kind: "domain", pattern: `domain:youtube.com`, label: "يوتيوب", ok: true };
    }
    if (u.pathname.startsWith("/results") || u.pathname === "" || u.pathname === "/") {
      return { kind: "domain", pattern: `domain:youtube.com`, label: "يوتيوب", ok: true };
    }
  }

  // Non-YouTube: treat as domain or url with path
  const path = u.pathname.replace(/\/+$/, "");
  if (path && path !== "/" && path.length > 1) {
    return {
      kind: "url",
      pattern: `url:${host}${path.toLowerCase()}`,
      label: `${host}${path}`,
      ok: true,
    };
  }
  return { kind: "domain", pattern: `domain:${host}`, label: guessLabel(host), ok: true };
}

export function scopeId(entry: { pattern: string }): string {
  return entry.pattern;
}

/** Check whether a destination is within the approved scope. */
export function isInScope(
  dest: NavDestination,
  allowedSites: ScopeEntry[]
): { allowed: boolean; matchedBy?: ScopeEntry } {
  for (const entry of allowedSites) {
    const p = entry.pattern;
    if (p.startsWith("yt:video:") && dest.videoId) {
      if (dest.videoId === p.slice("yt:video:".length)) return { allowed: true, matchedBy: entry };
    }
    if (p.startsWith("yt:channel:") && dest.channel) {
      if (dest.channel.toLowerCase() === p.slice("yt:channel:".length).toLowerCase())
        return { allowed: true, matchedBy: entry };
    }
    if (p.startsWith("yt:playlist:") && dest.playlistId) {
      if (dest.playlistId === p.slice("yt:playlist:".length)) return { allowed: true, matchedBy: entry };
    }
    if (p.startsWith("domain:")) {
      const host = p.slice("domain:".length);
      const destHost = dest.url.split("/")[0];
      if (destHost === host || destHost.endsWith(`.${host}`)) return { allowed: true, matchedBy: entry };
    }
    if (p.startsWith("url:")) {
      const target = p.slice("url:".length);
      if (dest.url.toLowerCase().startsWith(target)) return { allowed: true, matchedBy: entry };
    }
  }
  return { allowed: false };
}

const YT_WATCH_RE = /[?&]v=([\w-]{5,})/;
const YT_LIST_RE = /[?&]list=([\w-]+)/;
const YT_CHANNEL_RE = /(@[\w\u0600-\u06FF.-]+)/;

/** Resolve a URL string inside the simulated web into a NavDestination. */
export function resolveDestination(rawUrl: string): NavDestination {
  const norm = normalizeUrl(rawUrl);
  const host = norm.split("/")[0];
  const site = SITE_CATALOG.find((s) => host === s.host || host.endsWith(`.${s.host}`));

  if (site) {
    if (site.id === "youtube") {
      const vMatch = norm.match(YT_WATCH_RE);
      const listMatch = norm.match(YT_LIST_RE);
      const chMatch = norm.match(YT_CHANNEL_RE);
      if (vMatch) {
        const video = findVideo(vMatch[1]);
        if (video) {
          return {
            url: norm,
            siteId: "youtube_watch",
            title: video.title.ar,
            name: site.name.ar,
            category: video.category,
            videoId: video.id,
            channel: video.channel,
          };
        }
        return {
          url: norm,
          siteId: "youtube_watch",
          title: vMatch[1],
          name: site.name.ar,
          category: "unknown",
          videoId: vMatch[1],
        };
      }
      if (chMatch && chMatch[1] && norm.includes("/@")) {
        const ch = chMatch[1];
        return {
          url: norm,
          siteId: "youtube_channel",
          title: ch,
          name: site.name.ar,
          category: "education",
          channel: ch,
        };
      }
      if (listMatch) {
        return {
          url: norm,
          siteId: "youtube_playlist",
          title: listMatch[1],
          name: site.name.ar,
          category: "education",
          playlistId: listMatch[1],
        };
      }
      return { url: norm, siteId: "youtube", title: site.name.ar, name: site.name.ar, category: site.category, path: norm.slice(host.length) };
    }
    if (site.id === "google") {
      const qMatch = norm.match(/[?&]q=([^&]+)/);
      if (qMatch && norm.includes("/search")) {
        const query = decodeURIComponent(qMatch[1].replace(/\+/g, " "));
        return {
          url: norm,
          siteId: "google_results",
          title: query,
          name: site.name.ar,
          category: "search",
          query,
        };
      }
      return { url: norm, siteId: "google", title: site.name.ar, name: site.name.ar, category: site.category };
    }
    const path = norm.slice(host.length);
    return {
      url: norm,
      siteId: site.id,
      title: site.name.ar,
      name: site.name.ar,
      category: site.category,
      path,
    };
  }

  return {
    url: norm,
    siteId: "unknown",
    title: host || norm,
    name: host || norm,
    category: "unknown",
    path: norm,
  };
}

export function findVideo(id: string): CatalogVideo | null {
  return SITE_CATALOG.find((s) => s.id === "youtube")?.videos?.find((v) => v.id === id) ?? null;
}

/** Bilingual display name for a destination (falls back gracefully). */
export function siteDisplayName(dest: NavDestination, lang: Lang2): string {
  const site = SITE_CATALOG.find((s) => s.id === dest.siteId);
  return site ? site.name[lang] : dest.name;
}

type Lang2 = "ar" | "en";

/** Search query destination — evaluated like navigation. */
export function searchDestination(query: string): NavDestination {
  return {
    url: `google.com/search?q=${encodeURIComponent(query)}`,
    siteId: "google_results",
    title: query,
    name: "Google",
    category: "search",
    query,
  };
}
