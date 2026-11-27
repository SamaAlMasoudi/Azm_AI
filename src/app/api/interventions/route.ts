/* Record an intervention event (profile-scoped; used by the web flow when the
 * student self-corrects — the agent pipeline records its own decisions). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = await req.json();
    const sessionId = String(body.sessionId ?? "");
    const owned = sessionId
      ? await db.studySession.findFirst({ where: { id: sessionId, profileId: profile.id }, select: { id: true } })
      : null;
    if (!owned) return NextResponse.json({ ok: false }, { status: 200 });
    await db.intervention.create({
      data: {
        profileId: profile.id,
        sessionId,
        siteName: String(body.siteName ?? "").slice(0, 120),
        siteUrl: String(body.siteUrl ?? "").slice(0, 500),
        category: String(body.category ?? "unknown"),
        explanation: String(body.explanation ?? "").slice(0, 500),
        verdict: String(body.verdict ?? "rejected"),
        classification: String(body.classification ?? "distracting"),
        aiMessage: String(body.aiMessage ?? "").slice(0, 500),
        confidence: typeof body.confidence === "number" ? body.confidence : null,
        source: String(body.source ?? "link"),
        aiSource: String(body.aiSource ?? "heuristic"),
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
