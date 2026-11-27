/* Smart break request: judged by the agent as a multi-round conversation
 * with hard budget guard-rails (level-aware). */

import { NextResponse } from "next/server";
import { getOrCreateProfile, rateLimit } from "@/lib/azm/server/profile";
import { requestBreak } from "@/lib/azm/server/pipeline";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    if (!rateLimit(`break:${profile.id}`, 15, 10_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const lang: Lang = body.lang === "en" ? "en" : "ar";
    const text = typeof body.request === "string" ? body.request : "";
    return NextResponse.json(await requestBreak({ profile, text, lang }));
  } catch {
    return NextResponse.json({ status: "denied", message: "", source: "heuristic" }, { status: 200 });
  }
}
