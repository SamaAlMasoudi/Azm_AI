/* Chrome-extension bridge: secure sync endpoint.
 *
 * Security model (adapted from azm-ai v0.2.2 ExtServer):
 *  - pairing token required on every call, checked with timing-safe compare
 *  - per-token rate limiting (bucket of 60 requests / 10 s)
 *  - every payload size-limited + validated before use
 *  - the response carries queued commands (intervene / dismiss / close_tab /
 *    recheck) — no long-lived WebSocket needed, MV3 service-worker friendly
 */

import { NextResponse } from "next/server";
import { corsJson, corsOptions } from "@/lib/azm/server/http";
import { db } from "@/lib/db";
import {
  profileByPairingToken,
  asActivity,
  rateLimit,
  safeEqual,
} from "@/lib/azm/server/profile";
import { navigate, toChallengeDTO, type NavigateResult } from "@/lib/azm/server/pipeline";
import { drainCommands, markExtSeen, type ExtCommand } from "@/lib/azm/server/runtime";
import { challengeOpener, TIMEOUT_MESSAGES } from "@/lib/azm/server/agent";
import { toPersonalityId } from "@/lib/azm/server/ai";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";
export function OPTIONS(req: Request) { return corsOptions(req); }

const OVERLAY_UI: Record<Lang, { title: string; placeholder: string; send: string; thinking: string; hint: string; secondsShort: string; closing: string }> = {
  ar: {
    title: "عزم ينتظر تبريرك",
    placeholder: "لماذا تحتاج هذا الموقع الآن؟ اربطه بهدفك…",
    send: "إرسال",
    thinking: "عزم يفكر…",
    hint: "اكتب تبريرك — سيقرره الوكيل الذكي",
    secondsShort: "ث",
    closing: "انتهت المهلة — جارٍ إغلاق التبويب",
  },
  en: {
    title: "Azm is waiting for your justification",
    placeholder: "Why do you need this site right now? Tie it to your goal…",
    send: "Send",
    thinking: "Azm is thinking…",
    hint: "Type your justification — the agent will judge it",
    secondsShort: "s",
    closing: "Time is up — closing the tab",
  },
};

export async function POST(req: Request) {
  const token = req.headers.get("x-azm-token") ?? "";
  const profile = await profileByPairingToken(token);
  if (!profile) {
    return corsJson(req, { error: "invalid_token" }, { status: 401 });
  }
  if (!rateLimit(`ext:${profile.id}`, 60, 10_000)) {
    return corsJson(req, { error: "too_many_requests" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "invalid_json" }, { status: 400 });
  }
  const lang: Lang = body.lang === "en" ? "en" : "ar";
  markExtSeen(profile.id);

  let commands: ExtCommand[] = drainCommands(profile.id);
  let navigation: NavigateResult | null = null;

  // optionally report the active tab
  const activity = asActivity(body.activity);
  if (activity) {
    navigation = await navigate({
      profile,
      url: activity.url,
      domain: activity.domain,
      title: activity.title,
      source: "extension",
      tabId: typeof body.tabId === "number" ? Math.floor(body.tabId) : null,
      lang,
      salt: Math.floor(Math.random() * 4),
    });

    if (navigation.decision === "challenge" && navigation.challenge) {
      const c = navigation.challenge;
      if (typeof body.tabId === "number") {
        commands.push({
          type: "intervene",
          id: c.id,
          tabId: Math.floor(body.tabId),
          domain: c.domain,
          title: c.title,
          status: "asking",
          message: c.lines[0]?.text ?? challengeOpener({ lang, personality: "strict", gentle: c.classification === "uncertain", timerSec: c.timerSec, salt: 0 }),
          deadline: c.deadline,
          totalMs: c.timerSec * 1000,
          lang,
        });
      }
    }
  }

  // expire overdue challenges (extension-only: the web app enforces locally)
  const overdue = await db.challenge.findMany({
    where: { profileId: profile.id, status: "asking", kind: "site", source: "extension", deadline: { lt: new Date() } },
  });
  for (const c of overdue) {
    const session = c.sessionId ? await db.studySession.findUnique({ where: { id: c.sessionId } }) : null;
    const msg = TIMEOUT_MESSAGES[toPersonalityId(session?.personality ?? "strict")][lang];
    await db.challenge.update({
      where: { id: c.id },
      data: {
        status: "timeout",
        deadline: null,
        linesJson: JSON.stringify([...(JSON.parse(c.linesJson) as unknown[]), { role: "azm", text: msg }]),
      },
    });
    if (c.tabId != null) {
      commands.push({ type: "close_tab", id: c.id, tabId: c.tabId, domain: c.domain });
    }
    if (session) {
      await db.intervention.create({
        data: {
          profileId: profile.id,
          sessionId: session.id,
          siteName: (c.title || c.domain).slice(0, 120),
          siteUrl: c.url.slice(0, 500),
          category: c.category,
          explanation: "",
          verdict: "timeout",
          classification: "distracting",
          aiMessage: msg,
          source: "extension",
          aiSource: "heuristic",
        },
      });
      await db.studySession.update({
        where: { id: session.id },
        data: { interventionsBlocked: { increment: 1 } },
      });
    }
  }

  // live challenges so the overlay can re-render after service-worker restart
  const live = await db.challenge.findMany({
    where: { profileId: profile.id, status: { in: ["asking", "thinking", "denied"] }, kind: "site", source: "extension" },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const session = await db.studySession.findFirst({
    where: { profileId: profile.id, status: "active" },
    orderBy: { startedAt: "desc" },
  });

  const grants = await db.grant.findMany({
    where: { profileId: profile.id, expiresAt: { gt: new Date() } },
    select: { domain: true, expiresAt: true },
  });

  return corsJson(req, {
    ok: true,
    sessionActive: Boolean(session),
    onBreak: Boolean(session?.breakUntil && session.breakUntil.getTime() > Date.now()),
    goal: session ? { subject: session.goal, task: session.task } : null,
    remainingSec: session ? Math.max(0, session.workMinutes * 60 - (session.focusedSeconds % (session.workMinutes * 60))) : 0,
    commands,
    grants: grants.map((g) => ({ domain: g.domain, expiresAt: g.expiresAt.getTime() })),
    liveChallenges: live.map(toChallengeDTO),
    ui: OVERLAY_UI[lang],
  });
}

/** Exported for tests/manual verification of the timing-safe pairing check. */
export function pairingMatches(provided: string, expected: string): boolean {
  return safeEqual(provided, expected);
}
