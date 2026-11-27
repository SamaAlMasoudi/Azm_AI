/* Periodic sync of session counters from the client (profile-scoped) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const { id } = await params;
    const body = await req.json();

    const owned = await db.studySession.findFirst({ where: { id, profileId: profile.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ ok: false }, { status: 200 });

    const data: Record<string, unknown> = {
      focusedSeconds: Math.max(0, Number(body.focusedSeconds ?? 0)),
      breakSeconds: Math.max(0, Number(body.breakSeconds ?? 0)),
      distractionAttempts: Math.max(0, Number(body.distractionAttempts ?? 0)),
      interventionsBlocked: Math.max(0, Number(body.interventionsBlocked ?? 0)),
      interventionsApproved: Math.max(0, Number(body.interventionsApproved ?? 0)),
      interventionsUncertain: Math.max(0, Number(body.interventionsUncertain ?? 0)),
      rounds: Math.max(1, Number(body.rounds ?? 1)),
      treeStage: Math.max(0, Math.min(5, Number(body.treeStage ?? 0))),
    };
    if (body.breakUsedSeconds !== undefined) data.breakUsedSeconds = Math.max(0, Number(body.breakUsedSeconds ?? 0));
    if (body.breakUntil !== undefined) {
      data.breakUntil = typeof body.breakUntil === "number" && body.breakUntil > Date.now() ? new Date(Number(body.breakUntil)) : null;
    }

    await db.studySession.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
