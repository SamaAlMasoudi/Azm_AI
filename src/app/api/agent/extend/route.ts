/* Agent challenge window extension: the student needs more time to write a
 * justification. Extends the persisted deadline (reload-safe), caps the
 * number of extensions, and pauses the automated workflow until the new
 * deadline — the timer ring re-arms from the returned deadline. */

import { NextResponse } from "next/server";
import { getOrCreateProfile, rateLimit } from "@/lib/azm/server/profile";
import { CHALLENGE_EXTENSION_SEC, extendChallenge } from "@/lib/azm/server/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    if (!rateLimit(`extend:${profile.id}`, 12, 10_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
    const seconds = typeof body.seconds === "number" ? body.seconds : CHALLENGE_EXTENSION_SEC;
    if (!challengeId) return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
    const r = await extendChallenge({ profileId: profile.id, challengeId, seconds });
    return NextResponse.json(r);
  } catch {
    return NextResponse.json({ ok: false, deadline: null, extensions: 0, reason: "error" }, { status: 200 });
  }
}
