/* Delete a session group (profile-scoped) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const { id } = await params;
    await db.sessionGroup.deleteMany({ where: { id, profileId: profile.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
