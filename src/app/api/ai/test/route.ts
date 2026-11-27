/* POST /api/ai/test — "Test connection" for the Settings AI panel.
 *
 * Two modes, matching store.testAi():
 *  - Draft mode (JSON body present, e.g. {aiProvider, aiModel?, aiBaseUrl?, aiApiKey?}):
 *    tests exactly what the user typed WITHOUT saving anything. A pasted key is
 *    sanitized, used for this request only, never stored and never echoed back.
 *  - Saved mode (no body): tests the profile's persisted AI configuration.
 *
 * Expected failures always return HTTP 200 with {ok:false, error} so the real
 * message reaches the UI (non-2xx would be flattened to "network error" by the
 * client). Keys never appear in any response (scrubbed upstream in llm.ts).
 */

import { NextResponse } from "next/server";
import {
  getOrCreateProfile,
  cleanText,
  readKeyVault,
  sanitizeApiKey,
  resolveKeyFor,
  rateLimit,
} from "@/lib/azm/server/profile";
import { resolveProvider, testProvider, type ProviderConfig } from "@/lib/azm/server/llm";
import { isProviderId, providerMeta, effectiveBaseUrl } from "@/lib/azm/server/providers";
import { describeDbError } from "@/lib/db";

export const runtime = "nodejs";

interface TestBody {
  aiProvider?: unknown;
  aiModel?: unknown;
  aiBaseUrl?: unknown;
  aiApiKey?: unknown;
}

export async function POST(req: Request) {
  try {
    // The profile is only needed for the rate limit, the key vault and "saved
    // mode". A database problem must NOT make every provider look unreachable:
    // a draft test (provider + typed key/URL) is independent of the database.
    let profile: Awaited<ReturnType<typeof getOrCreateProfile>> | null = null;
    let dbProblem = "";
    try {
      profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    } catch (e) {
      dbProblem = describeDbError(e);
      console.error("[api/ai/test] profile lookup failed:", e);
    }

    // Each test is a real provider round-trip — keep it bounded per profile.
    const limiterKey = profile?.id ?? `anon:${String(req.headers.get("x-azm-profile") ?? "").slice(0, 16)}`;
    if (!rateLimit(`ai-test:${limiterKey}`, 12, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many connection tests — wait a minute and try again." });
    }

    const body = (await req.json().catch(() => ({}))) as TestBody;

    // Saved mode: no provider in the body → test the persisted configuration.
    if (typeof body.aiProvider !== "string" || !body.aiProvider.trim()) {
      if (!profile) return NextResponse.json({ ok: false, error: dbProblem });
      const cfg = resolveProvider(profile);
      if (!cfg) return NextResponse.json({ ok: true, off: true });
      const ms = await testProvider(cfg);
      return NextResponse.json({ ok: true, ms, provider: cfg.kind, model: cfg.model });
    }

    const requested = body.aiProvider.trim();
    if (!isProviderId(requested)) {
      return NextResponse.json({ ok: false, error: "Unknown provider." });
    }
    const meta = providerMeta(requested);

    if (meta.id === "off") {
      return NextResponse.json({ ok: true, off: true, provider: "off" });
    }

    if (meta.id === "builtin") {
      const ms = await testProvider({ kind: "builtin", apiKey: "", model: "zai", baseUrl: "" });
      return NextResponse.json({ ok: true, ms, provider: "builtin", model: "zai" });
    }

    // Draft key resolution: what the user typed > vault > saved active key.
    // Mirrors the save path (resolveKeyFor) so the test previews the real thing.
    const vault = profile ? readKeyVault(profile) : {};
    const draftKey = sanitizeApiKey(body.aiApiKey);
    const apiKey = meta.requiresKey
      ? resolveKeyFor(vault, meta.id, draftKey, profile?.aiProvider ?? "", profile?.aiApiKey ?? "")
      : "";
    if (meta.requiresKey && !apiKey) {
      return NextResponse.json({
        ok: false,
        provider: meta.id,
        error: profile
          ? `No API key for ${meta.id} yet — paste a key (it stays on the server) and test again.`
          : `No API key for ${meta.id} was typed, and saved keys cannot be read: ${dbProblem}`,
      });
    }

    // Draft base URL: the value in the field ("" → provider default), same
    // normalization as the save path so the test hits the same endpoint the
    // saved config will use.
    const baseUrl = effectiveBaseUrl(meta, typeof body.aiBaseUrl === "string" ? body.aiBaseUrl : "");
    if (!baseUrl) {
      return NextResponse.json({ ok: false, provider: meta.id, error: "Base URL is missing." });
    }

    const cfg: ProviderConfig = {
      kind: meta.id,
      apiKey,
      model: cleanText(body.aiModel, 200) || meta.defaultModel,
      baseUrl,
    };
    const ms = await testProvider(cfg);
    return NextResponse.json({ ok: true, ms, provider: cfg.kind, model: cfg.model });
  } catch (e) {
    // Provider/network errors are readable Error messages from llm.ts —
    // surface them verbatim (secrets are scrubbed there), never a raw 500.
    const msg = (e as Error)?.message || "Connection test failed.";
    return NextResponse.json({ ok: false, error: msg });
  }
}
