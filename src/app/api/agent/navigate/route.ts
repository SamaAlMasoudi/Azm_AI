/* Agent navigation gate: classify intent -> policy -> allow or challenge. */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile, asActivity, rateLimit } from "@/lib/azm/server/profile";
import { navigate, toChallengeDTO } from "@/lib/azm/server/pipeline";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    if (!rateLimit(`nav:${profile.id}`, 90, 10_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const rawUrl = typeof body.url === "string" ? body.url : "";
    const activity = asActivity({ url: rawUrl, domain: rawUrl.split("/")[0] ?? "", title: typeof body.title === "string" ? body.title : "" });
    if (!activity) return NextResponse.json({ error: "invalid activity" }, { status: 400 });

    const lang: Lang = body.lang === "en" ? "en" : "ar";
    const result = await navigate({
      profile,
      url: activity.url,
      domain: activity.domain,
      title: activity.title,
      categoryHint: typeof body.category === "string" ? body.category : undefined,
      source: (["link", "address_bar", "search"].includes(String(body.source)) ? body.source : "link") as "link" | "address_bar" | "search",
      tabId: null,
      lang,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ sessionActive: false, onBreak: false, decision: "allow" });
  }
}

/** Land a specific challenge by id (used to re-open the overlay after reload). */
export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    const challenge = await db.challenge.findFirst({ where: { id, profileId: profile.id } });
    if (!challenge) return NextResponse.json({ challenge: null });
    return NextResponse.json({ challenge: toChallengeDTO(challenge) });
  } catch {
    return NextResponse.json({ challenge: null });
  }
}
