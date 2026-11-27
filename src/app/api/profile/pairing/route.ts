/* Regenerate the pairing token used by the Chrome extension. */

import { NextResponse } from "next/server";
import { getOrCreateProfile, regeneratePairingToken } from "@/lib/azm/server/profile";
import { describeDbError } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const token = await regeneratePairingToken(profile.id);
    return NextResponse.json({ pairingToken: token });
  } catch (e) {
    console.error("[api/profile/pairing] regenerate failed:", e);
    return NextResponse.json({ error: `Could not regenerate the pairing token: ${describeDbError(e)}` }, { status: 500 });
  }
}
