/* AI verification of the claimed achievement against the expected outcome
 * (profile-aware, memory-injected). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { resolveProvider } from "@/lib/azm/server/llm";
import { verifyOutcome, toPersonalityId, heuristicVerify } from "@/lib/azm/server/ai";
import { memoryTexts } from "@/lib/azm/server/pipeline";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = (await req.json()) as Record<string, unknown>;
    const lang: Lang = body.lang === "en" ? "en" : "ar";

    const active = await db.studySession.findFirst({
      where: { profileId: profile.id, status: "active" },
      orderBy: { startedAt: "desc" },
    });

    const result = await verifyOutcome({
      cfg: resolveProvider(profile),
      lang,
      personality: toPersonalityId(String(active?.personality ?? body.personality ?? "strict")),
      memory: await memoryTexts(profile.id, 10),
      expectedOutcome: String(active?.expectedOutcome ?? body.expectedOutcome ?? ""),
      accomplishments: typeof body.accomplishments === "string" ? body.accomplishments : "",
      focusedMinutes: Number(active ? Math.floor(active.focusedSeconds / 60) : body.focusedMinutes ?? 0),
      plannedMinutes: Number(active?.workMinutes ?? body.plannedMinutes ?? 25),
      blockedAttempts: Number(active?.interventionsBlocked ?? body.blockedAttempts ?? 0),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(heuristicVerify("", 0, 25, "ar"), { status: 200 });
  }
}
