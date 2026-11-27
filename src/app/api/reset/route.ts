/* Wipe this profile's data (settings, memory, pairing token are kept) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile, rateLimit } from "@/lib/azm/server/profile";
import { corsJson, corsOptions } from "@/lib/azm/server/http";

export const runtime = "nodejs";
export function OPTIONS(req: Request) { return corsOptions(req); }

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.AZM_ALLOW_RESET !== "true") {
    return corsJson(req, { error: "reset_disabled_in_production" }, { status: 403 });
  }
  if (!rateLimit(`reset:${req.headers.get("x-azm-profile") || req.headers.get("x-forwarded-for") || "unknown"}`, 2, 60_000)) {
    return corsJson(req, { error: "too_many_requests" }, { status: 429 });
  }
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    // close any active challenge first
    await db.challenge.updateMany({ where: { profileId: profile.id }, data: { status: "left" } });
    await db.intervention.deleteMany({ where: { profileId: profile.id } });
    await db.emergencyPass.deleteMany({ where: { profileId: profile.id } });
    await db.studySession.deleteMany({ where: { profileId: profile.id } });
    await db.sessionGroup.deleteMany({ where: { profileId: profile.id } });
    await db.grant.deleteMany({ where: { profileId: profile.id } });
    await db.memoryItem.deleteMany({ where: { profileId: profile.id } });
    return corsJson(req, { ok: true });
  } catch {
    return corsJson(req, { ok: false }, { status: 500 });
  }
}
