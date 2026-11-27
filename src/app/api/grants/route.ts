/* Temporary Access — active (unexpired) grants for the current profile. */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const now = new Date();
    const grants = await db.grant.findMany({
      where: { profileId: profile.id, expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
      take: 20,
    });
    return NextResponse.json({
      grants: grants.map((g) => ({
        id: g.id,
        domain: g.domain,
        minutes: g.minutes,
        reason: g.reason,
        source: g.source,
        grantedAt: g.grantedAt.toISOString(),
        expiresAt: g.expiresAt.getTime(),
      })),
    });
  } catch {
    return NextResponse.json({ grants: [] });
  }
}
