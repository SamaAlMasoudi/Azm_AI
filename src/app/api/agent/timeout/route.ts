/* Agent timeout: the countdown expired with no justification. */

import { NextResponse } from "next/server";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { timeoutChallenge } from "@/lib/azm/server/pipeline";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = (await req.json()) as Record<string, unknown>;
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    if (!challengeId) return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
    const lang: Lang = body.lang === "en" ? "en" : "ar";
    return NextResponse.json(await timeoutChallenge(profile.id, challengeId, lang));
  } catch {
    return NextResponse.json({ status: "denied", message: "", source: "heuristic" });
  }
}
