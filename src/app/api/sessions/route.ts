/* Create a study session (profile-scoped, level snapshot) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { normalizeLevel } from "@/lib/azm/policy";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = await req.json();
    const goal = String(body.goal ?? "").trim();
    const task = String(body.task ?? "").trim();
    const expectedOutcome = String(body.expectedOutcome ?? "").trim();
    const technique = ["pomodoro", "5217", "custom"].includes(body.technique) ? body.technique : "pomodoro";
    const workMinutes = Math.max(5, Math.min(180, Number(body.workMinutes ?? 25)));
    const breakMinutes = Math.max(3, Math.min(30, Number(body.breakMinutes ?? 5)));
    const personality = ["strict", "friend", "philosopher"].includes(body.personality)
      ? body.personality
      : "strict";
    const allowedSites = Array.isArray(body.allowedSites) ? body.allowedSites : [];

    if (!goal || !task) {
      return NextResponse.json({ error: "goal and task are required" }, { status: 400 });
    }

    const session = await db.studySession.create({
      data: {
        profileId: profile.id,
        goal,
        task,
        expectedOutcome,
        technique,
        workMinutes,
        breakMinutes,
        personality,
        level: normalizeLevel(profile.interventionLevel),
        allowedSites: JSON.stringify(allowedSites),
      },
    });

    return NextResponse.json({ id: session.id, startedAt: session.startedAt, level: session.level });
  } catch {
    return NextResponse.json({ error: "failed to create session" }, { status: 500 });
  }
}
