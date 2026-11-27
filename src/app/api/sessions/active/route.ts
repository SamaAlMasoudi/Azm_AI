/* Get the profile's currently active session (for resume) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { normalizeLevel } from "@/lib/azm/policy";
import type { ActiveSession, ScopeEntry } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const row = await db.studySession.findFirst({
      where: { profileId: profile.id, status: "active" },
      orderBy: { startedAt: "desc" },
    });
    if (!row) return NextResponse.json({ session: null });

    let allowedSites: ScopeEntry[] = [];
    try {
      allowedSites = JSON.parse(row.allowedSites);
    } catch {
      allowedSites = [];
    }

    const session: ActiveSession = {
      id: row.id,
      goal: row.goal,
      task: row.task,
      expectedOutcome: row.expectedOutcome,
      technique: row.technique as ActiveSession["technique"],
      workMinutes: row.workMinutes,
      breakMinutes: row.breakMinutes,
      personality: row.personality as ActiveSession["personality"],
      level: normalizeLevel(row.level),
      allowedSites,
      startedAt: row.startedAt.getTime(),
      focusedSeconds: row.focusedSeconds,
      breakSeconds: row.breakSeconds,
      breakUsedSeconds: row.breakUsedSeconds,
      breakUntil: row.breakUntil ? row.breakUntil.getTime() : null,
      distractionAttempts: row.distractionAttempts,
      interventionsBlocked: row.interventionsBlocked,
      interventionsApproved: row.interventionsApproved,
      interventionsUncertain: row.interventionsUncertain,
      rounds: row.rounds,
      emergencyPassUsed: row.emergencyPassUsed,
    };
    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ session: null });
  }
}
