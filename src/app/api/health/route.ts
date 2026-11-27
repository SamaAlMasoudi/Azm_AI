/* GET /api/health — diagnostic: can this server reach its database?
 *
 * Exists so a failing deployment says WHY (client not generated, engine
 * missing, database file unreachable) instead of the UI showing a generic
 * "network error". Public by design and therefore minimal: no secrets, no
 * paths, no row data — only ok/failed per component and a one-line hint.
 */

import { NextResponse } from "next/server";
import { db, describeDbError } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: { ok: boolean; hint?: string } = { ok: true };
  try {
    await db.profile.count({ where: {} });
  } catch (e) {
    console.error("[api/health] database check failed:", e);
    database = { ok: false, hint: describeDbError(e) };
  }
  return NextResponse.json({ ok: database.ok, database }, { status: database.ok ? 200 : 503 });
}
