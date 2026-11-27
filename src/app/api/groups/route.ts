/* Session groups: list + create/update (profile-scoped) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import type { SessionGroupDTO, ScopeEntry } from "@/lib/azm/types";

export const runtime = "nodejs";

function toDTO(row: {
  id: string;
  name: string;
  goal: string;
  task: string;
  expectedOutcome: string;
  technique: string;
  workMinutes: number;
  breakMinutes: number;
  personality: string;
  allowedSites: string;
  createdAt: Date;
}): SessionGroupDTO {
  let allowedSites: ScopeEntry[] = [];
  try {
    allowedSites = JSON.parse(row.allowedSites);
  } catch {
    allowedSites = [];
  }
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    task: row.task,
    expectedOutcome: row.expectedOutcome,
    technique: row.technique as SessionGroupDTO["technique"],
    workMinutes: row.workMinutes,
    breakMinutes: row.breakMinutes,
    personality: row.personality as SessionGroupDTO["personality"],
    allowedSites,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const rows = await db.sessionGroup.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ groups: rows.map(toDTO) });
  } catch {
    return NextResponse.json({ groups: [] });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const goal = String(body.goal ?? "").trim();
    const task = String(body.task ?? "").trim();
    const expectedOutcome = String(body.expectedOutcome ?? "").trim();
    if (!name || !goal || !task) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const technique = ["pomodoro", "5217", "custom"].includes(body.technique) ? body.technique : "pomodoro";
    const workMinutes = Math.max(5, Math.min(180, Number(body.workMinutes ?? 25)));
    const breakMinutes = Math.max(3, Math.min(30, Number(body.breakMinutes ?? 5)));
    const personality = ["strict", "friend", "philosopher"].includes(body.personality)
      ? body.personality
      : "strict";
    const allowedSites = Array.isArray(body.allowedSites) ? body.allowedSites : [];

    const data = {
      profileId: profile.id,
      name,
      goal,
      task,
      expectedOutcome,
      technique,
      workMinutes,
      breakMinutes,
      personality,
      allowedSites: JSON.stringify(allowedSites),
    };

    // update only when the group belongs to this profile
    const existingId = typeof body.id === "string" && body.id.length > 0 ? body.id : null;
    const owned = existingId
      ? await db.sessionGroup.findFirst({ where: { id: existingId, profileId: profile.id } })
      : null;
    const group = owned
      ? await db.sessionGroup.update({ where: { id: owned.id }, data })
      : await db.sessionGroup.create({ data });

    return NextResponse.json({ group: toDTO(group) });
  } catch {
    return NextResponse.json({ error: "failed to save group" }, { status: 500 });
  }
}
