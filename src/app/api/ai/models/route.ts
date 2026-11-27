/* Live model list for the active (or requested) provider.
 * Groq/Ollama/OpenAI-compatible: GET {baseUrl}/models. Falls back to the
 * curated catalog on any failure so the UI always has something to show. */

import { NextResponse } from "next/server";
import { getOrCreateProfile, cleanText, readKeyVault, sanitizeApiKey } from "@/lib/azm/server/profile";
import { listProviderModels, type ProviderConfig } from "@/lib/azm/server/llm";
import { isProviderId, providerMeta, effectiveBaseUrl, type ProviderMeta } from "@/lib/azm/server/providers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // hoisted so the catch can fall back to the curated catalog for the
  // requested provider even when the live fetch fails mid-way
  let requested = "";
  let meta: ProviderMeta | null = null;
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const { searchParams } = new URL(req.url);
    requested = searchParams.get("provider") ?? profile.aiProvider;
    const id = isProviderId(requested) ? providerMeta(requested).id : providerMeta(profile.aiProvider).id;
    meta = providerMeta(id);

    if (meta.id === "off" || meta.id === "builtin") {
      return NextResponse.json({ provider: meta.id, live: false, models: meta.models });
    }

    const apiKey = meta.requiresKey
      ? sanitizeApiKey(
          cleanText(searchParams.get("key"), 300) ||
            (meta.id === providerMeta(profile.aiProvider).id ? profile.aiApiKey : "") ||
            readKeyVault(profile)[meta.id] ||
            ""
        )
      : "";
    if (meta.requiresKey && !apiKey) {
      return NextResponse.json({
        provider: meta.id,
        live: false,
        error: "key-missing",
        models: meta.models,
      });
    }

    const baseUrl = effectiveBaseUrl(meta, profile.aiBaseUrl);
    if (!baseUrl) {
      return NextResponse.json({ provider: meta.id, live: false, error: "base-url-missing", models: meta.models });
    }

    const cfg: ProviderConfig = { kind: meta.id, apiKey, model: meta.defaultModel, baseUrl };
    const live = await listProviderModels(cfg);
    // stable copy: `meta` is a mutable outer `let`, so TS refuses to keep the
    // non-null narrowing inside the map closure below
    const activeId = meta.id;
    return NextResponse.json({
      provider: activeId,
      live: true,
      models: live.models.map((m) => ({
        id: m.id,
        tier: activeId === "ollama" ? "local" : activeId === "groq" ? "free_tier" : "paid",
      })),
    });
  } catch (e) {
    const err = (e as Error).message || "model list failed";
    // curated fallback on ANY failure (live fetch threw, e.g. network-blocked
    // provider) so the UI always has the known-good model IDs to offer
    return NextResponse.json(
      { provider: requested || "unknown", live: false, error: err, models: meta?.models ?? [] },
      { status: 200 }
    );
  }
}
