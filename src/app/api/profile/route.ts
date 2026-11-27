/* Profile bootstrap + settings. Every other route scopes data by this profile. */

import { NextResponse } from "next/server";
import { db, describeDbError } from "@/lib/db";
import { getOrCreateProfile, publicAi, readKeyVault, resolveKeyFor, sanitizeApiKey } from "@/lib/azm/server/profile";
import { normalizeLevel, isLevel } from "@/lib/azm/policy";
import { isProviderId, providerMeta } from "@/lib/azm/server/providers";
import { extLastSeen } from "@/lib/azm/server/runtime";

export const runtime = "nodejs";

async function payload(profileId: string) {
  const [profile, memoryCount, activeSession] = await Promise.all([
    db.profile.findUniqueOrThrow({ where: { id: profileId } }),
    db.memoryItem.count({ where: { profileId } }),
    db.studySession.findFirst({ where: { profileId, status: "active" }, select: { id: true } }),
  ]);
  const seen = extLastSeen(profileId);
  return {
    profile: {
      code: profile.code,
      name: profile.name,
      lang: profile.lang,
      interventionLevel: normalizeLevel(profile.interventionLevel),
      ai: publicAi(profile),
      pairingToken: profile.pairingToken,
      memoryCount,
      hasActiveSession: Boolean(activeSession),
      createdAt: profile.createdAt.toISOString(),
      extConnected: Boolean(seen && Date.now() - seen < 15_000),
      extLastSeen: seen,
    },
  };
}

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    return NextResponse.json(await payload(profile.id));
  } catch (e) {
    console.error("[api/profile] GET failed:", e);
    return NextResponse.json({ error: `Profile bootstrap failed: ${describeDbError(e)}` }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") data.name = body.name.trim().slice(0, 60);
    if (body.lang === "ar" || body.lang === "en") data.lang = body.lang;
    if (isLevel(body.interventionLevel)) data.interventionLevel = body.interventionLevel;

    // configurable human-intervention window (10–120s, default 30)
    if (typeof body.challengeSeconds === "number" && Number.isFinite(body.challengeSeconds)) {
      data.challengeSeconds = Math.max(10, Math.min(120, Math.round(body.challengeSeconds)));
    }

    // provider switch: mirror the right vaulted key into aiApiKey
    if (typeof body.aiProvider === "string" && isProviderId(body.aiProvider)) {
      const nextProvider = body.aiProvider;
      // sanitize at storage time so paste artifacts never reach the vault
      const explicitKey = sanitizeApiKey(body.aiApiKey);
      const vault = readKeyVault(profile);
      const resolvedKey = resolveKeyFor(
        vault,
        nextProvider,
        explicitKey,
        providerMeta(profile.aiProvider).id,
        profile.aiApiKey
      );
      const meta = providerMeta(nextProvider);
      data.aiProvider = nextProvider;
      data.aiApiKey = meta.requiresKey ? resolvedKey : "";
      if (explicitKey) {
        // persist the freshly entered key into the vault too
        data.aiKeysJson = JSON.stringify({ ...vault, [nextProvider]: explicitKey });
      }
    } else if (typeof body.aiApiKey === "string" && body.aiApiKey.trim()) {
      // key update without switching providers
      const current = providerMeta(profile.aiProvider).id;
      const vault = readKeyVault(profile);
      const key = sanitizeApiKey(body.aiApiKey);
      vault[current] = key;
      data.aiApiKey = key;
      data.aiKeysJson = JSON.stringify(vault);
    }

    if (typeof body.aiModel === "string") data.aiModel = body.aiModel.trim().slice(0, 120);
    if (typeof body.aiBaseUrl === "string") data.aiBaseUrl = body.aiBaseUrl.trim().slice(0, 300);

    await db.profile.update({ where: { id: profile.id }, data });
    return NextResponse.json(await payload(profile.id));
  } catch (e) {
    console.error("[api/profile] PATCH failed:", e);
    return NextResponse.json({ error: `Profile update failed: ${describeDbError(e)}` }, { status: 500 });
  }
}
