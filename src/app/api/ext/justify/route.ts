/* Chrome-extension bridge: student answered the overlay challenge.
 * The overlay updates immediately from the response; state sync follows. */

import { NextResponse } from "next/server";
import { corsJson, corsOptions } from "@/lib/azm/server/http";
import { profileByPairingToken, rateLimit } from "@/lib/azm/server/profile";
import { justify } from "@/lib/azm/server/pipeline";

export const runtime = "nodejs";
export function OPTIONS(req: Request) { return corsOptions(req); }

export async function POST(req: Request) {
  const profile = await profileByPairingToken(req.headers.get("x-azm-token") ?? "");
  if (!profile) return corsJson(req, { error: "invalid_token" }, { status: 401 });
  if (!rateLimit(`extj:${profile.id}`, 30, 10_000)) {
    return corsJson(req, { error: "too_many_requests" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const rawText = typeof body.text === "string" ? body.text : "";
  if (!id || !rawText.trim()) return corsJson(req, { error: "id_and_text_required" }, { status: 400 });

  try {
    const result = await justify({ profile, challengeId: id, text: rawText });
    return corsJson(req, result);
  } catch {
    return corsJson(req, { status: "denied", message: "", source: "heuristic" });
  }
}
