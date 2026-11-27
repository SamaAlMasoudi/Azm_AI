/* AI dialogue before ending a session (profile-aware, memory-injected). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { resolveProvider } from "@/lib/azm/server/llm";
import { decideEnd, toPersonalityId, heuristicEnd } from "@/lib/azm/server/ai";
import { memoryTexts } from "@/lib/azm/server/pipeline";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = (await req.json()) as Record<string, unknown>;
    const lang: Lang = body.lang === "en" ? "en" : "ar";
    const session = (body.session ?? {}) as Record<string, unknown>;

    // the authoritative session data comes from the server (active session)
    const active = await db.studySession.findFirst({
      where: { profileId: profile.id, status: "active" },
      orderBy: { startedAt: "desc" },
    });

    const result = await decideEnd({
      cfg: resolveProvider(profile),
      lang,
      personality: toPersonalityId(String(active?.personality ?? body.personality ?? "strict")),
      memory: await memoryTexts(profile.id, 10),
      session: {
        goal: String(active?.goal ?? session.goal ?? ""),
        task: String(active?.task ?? session.task ?? ""),
        expectedOutcome: String(active?.expectedOutcome ?? session.expectedOutcome ?? ""),
        plannedMinutes: Number(active?.workMinutes ?? session.plannedMinutes ?? 25),
        focusedMinutes: Number(active ? Math.floor(active.focusedSeconds / 60) : session.focusedMinutes ?? 0),
        remainingMinutes: Number(session.remainingMinutes ?? 0),
        attempts: Number(active?.distractionAttempts ?? session.attempts ?? 0),
      },
      reason: typeof body.reason === "string" ? body.reason : "",
      hasPass: Boolean(body.hasPass),
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(heuristicEnd(0, 25, false, "ar"), { status: 200 });
  }
}
