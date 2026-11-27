/* Emergency pass: one per ISO week (profile-scoped) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { getISOWeek, startOfISOWeek } from "date-fns";

export const runtime = "nodejs";

function currentWeekKey(): string {
  const now = new Date();
  const week = getISOWeek(now);
  const year = startOfISOWeek(now).getFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const weekKey = currentWeekKey();
    const existing = await db.emergencyPass.findFirst({ where: { weekKey, profileId: profile.id } });
    return NextResponse.json({ used: Boolean(existing) });
  } catch {
    return NextResponse.json({ used: false });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = await req.json().catch(() => ({}));
    const weekKey = currentWeekKey();
    const existing = await db.emergencyPass.findFirst({ where: { weekKey, profileId: profile.id } });
    if (existing) {
      return NextResponse.json({ ok: false, reason: "already used this week" }, { status: 200 });
    }
    await db.emergencyPass.create({
      data: {
        profileId: profile.id,
        weekKey,
        sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
