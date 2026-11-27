/* End a session: persist counters, verification, and the full session report */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { levelOf } from "@/lib/azm/server/pipeline";
import type { ScopeEntry } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const { id } = await params;
    const body = await req.json();
    const snap = body.snapshot ?? {};

    const session = await db.studySession.findFirst({ where: { id, profileId: profile.id } });
    if (!session) return NextResponse.json({ ok: false }, { status: 200 });

    const data: Record<string, unknown> = {
      status: "ended",
      endedAt: new Date(),
      focusedSeconds: Math.max(0, Number(snap.focusedSeconds ?? 0)),
      breakSeconds: Math.max(0, Number(snap.breakSeconds ?? 0)),
      distractionAttempts: Math.max(0, Number(snap.distractionAttempts ?? 0)),
      interventionsBlocked: Math.max(0, Number(snap.interventionsBlocked ?? 0)),
      interventionsApproved: Math.max(0, Number(snap.interventionsApproved ?? 0)),
      interventionsUncertain: Math.max(0, Number(snap.interventionsUncertain ?? 0)),
      rounds: Math.max(1, Number(snap.rounds ?? 1)),
      treeStage: Math.max(0, Math.min(5, Number(snap.treeStage ?? 0))),
      emergencyPassUsed: Boolean(body.emergencyPassUsed),
    };
    if (snap.breakUsedSeconds !== undefined) data.breakUsedSeconds = Math.max(0, Number(snap.breakUsedSeconds ?? 0));
    if (typeof body.accomplishments === "string") data.accomplishments = body.accomplishments;
    if (body.verification && typeof body.verification === "object") {
      data.verificationVerdict = String(body.verification.verdict ?? "");
      data.verificationMessage = String(body.verification.message ?? "");
    }

    // Session Report: activity log, agent decisions, grants, memory, counters
    const [interventions, grants, memory] = await Promise.all([
      db.intervention.findMany({
        where: { profileId: profile.id, sessionId: id },
        orderBy: { createdAt: "asc" },
      }),
      db.grant.findMany({
        where: { profileId: profile.id, sessionId: id },
        orderBy: { grantedAt: "asc" },
      }),
      db.memoryItem.findMany({
        where: { profileId: profile.id, source: "agent", createdAt: { gte: session.startedAt } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const { levelId, lv } = levelOf(session);
    let allowedSites: ScopeEntry[] = [];
    try {
      allowedSites = JSON.parse(session.allowedSites);
    } catch {
      allowedSites = [];
    }

    data.reportJson = JSON.stringify({
      level: levelId,
      plannedMinutes: session.workMinutes,
      breakBudgetMin: lv.breakBudgetMin,
      breakUsedMin: Math.round((Number(data.breakUsedSeconds ?? session.breakUsedSeconds) || 0) / 60),
      resources: allowedSites.map((s) => s.label || s.raw),
      classificationCounts: {
        supportive: interventions.filter((i) => i.classification === "supportive").length,
        uncertain: interventions.filter((i) => i.classification === "uncertain").length,
        distracting: interventions.filter((i) => i.classification === "distracting").length,
        selfCorrected: interventions.filter((i) => i.verdict === "self_corrected").length,
      },
      interventions: interventions.map((i) => ({
        id: i.id,
        at: i.createdAt.toISOString(),
        site: i.siteName,
        url: i.siteUrl,
        category: i.category,
        verdict: i.verdict,
        classification: i.classification,
        explanation: i.explanation,
        aiMessage: i.aiMessage,
        source: i.source,
        aiSource: i.aiSource,
      })),
      grants: grants.map((g) => ({
        domain: g.domain,
        minutes: g.minutes,
        reason: g.reason,
        grantedAt: g.grantedAt.toISOString(),
        expiresAt: g.expiresAt.toISOString(),
      })),
      memoryAdded: memory.map((m) => ({ text: m.text, source: m.source, at: m.createdAt.toISOString() })),
      accomplishments: typeof body.accomplishments === "string" ? body.accomplishments : "",
    });

    await db.studySession.update({ where: { id }, data });
    let report: unknown = null;
    try {
      report = JSON.parse(String(data.reportJson));
    } catch {
      report = null;
    }
    return NextResponse.json({ ok: true, report });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
