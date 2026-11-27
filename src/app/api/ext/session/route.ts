import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeLevel } from "@/lib/azm/policy";
import { profileByPairingToken, rateLimit, cleanText } from "@/lib/azm/server/profile";
import { corsJson, corsOptions } from "@/lib/azm/server/http";

export const runtime = "nodejs";
export function OPTIONS(req: Request) { return corsOptions(req); }

export async function POST(req: Request) {
  const profile = await profileByPairingToken(req.headers.get("x-azm-token") ?? "");
  if (!profile) return corsJson(req, { error: "invalid_token" }, { status: 401 });
  if (!rateLimit(`ext-session:${profile.id}`, 20, 60_000)) {
    return corsJson(req, { error: "too_many_requests" }, { status: 429 });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action === "end" ? "end" : "start";
    if (action === "end") {
      const active = await db.studySession.findFirst({ where: { profileId: profile.id, status: "active" }, orderBy: { startedAt: "desc" } });
      if (active) await db.studySession.update({ where: { id: active.id }, data: { status: "ended", endedAt: new Date() } });
      return corsJson(req, { ok: true, id: active?.id ?? null });
    }
    const goal = cleanText(body.goal, 300);
    const task = cleanText(body.task, 500);
    if (!goal || !task) return corsJson(req, { error: "goal_and_task_required" }, { status: 400 });
    await db.studySession.updateMany({ where: { profileId: profile.id, status: "active" }, data: { status: "ended", endedAt: new Date() } });
    const urls = Array.isArray(body.urls) ? body.urls.filter((v): v is string => typeof v === "string").slice(0, 100) : [];
    const allowedSites = urls.map((raw) => {
      try {
        const u = new URL(raw);
        return { id: u.hostname, raw, pattern: `domain:${u.hostname.replace(/^www\./, "").toLowerCase()}`, kind: "domain", label: u.hostname };
      } catch { return null; }
    }).filter(Boolean);
    const workMinutes = Math.max(1, Math.min(360, Math.round(Number(body.durationMinutes) || 25)));
    const session = await db.studySession.create({
      data: {
        profileId: profile.id,
        goal,
        task,
        expectedOutcome: cleanText(body.outcome, 300),
        technique: "custom",
        workMinutes,
        breakMinutes: 5,
        personality: body.persona === "strict" ? "strict" : body.persona === "philosopher" ? "philosopher" : "friend",
        level: normalizeLevel(profile.interventionLevel),
        allowedSites: JSON.stringify(allowedSites),
      },
    });
    return corsJson(req, { ok: true, id: session.id, startedAt: session.startedAt.getTime(), level: session.level });
  } catch {
    return corsJson(req, { error: "failed_to_update_session" }, { status: 500 });
  }
}
