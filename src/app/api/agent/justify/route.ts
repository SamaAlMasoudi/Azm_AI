/* Agent justification: the student answers the challenge -> agent decision. */

import { NextResponse } from "next/server";
import { getOrCreateProfile, rateLimit } from "@/lib/azm/server/profile";
import { justify } from "@/lib/azm/server/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    if (!rateLimit(`justify:${profile.id}`, 30, 10_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const text = typeof body.text === "string" ? body.text : "";
    if (!challengeId || !text.trim()) {
      return NextResponse.json({ error: "challengeId and text are required" }, { status: 400 });
    }
    return NextResponse.json(await justify({ profile, challengeId, text }));
  } catch {
    return NextResponse.json({ status: "denied", message: "", source: "heuristic" });
  }
}
