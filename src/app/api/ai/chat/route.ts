/* Free conversation with Azm (Floating Orb chat): persona voice, memory-aware,
 * can save durable notes about the student. */

import { NextResponse } from "next/server";
import { getOrCreateProfile, cleanText, rateLimit } from "@/lib/azm/server/profile";
import { resolveProvider } from "@/lib/azm/server/llm";
import { agentChat, type ChatLine } from "@/lib/azm/server/agent";
import { toPersonalityId } from "@/lib/azm/server/ai";
import { memoryTexts, addMemory } from "@/lib/azm/server/pipeline";
import { db } from "@/lib/db";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

const MAX_LINES = 12;

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    if (!rateLimit(`chat:${profile.id}`, 20, 10_000)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    const body = (await req.json()) as Record<string, unknown>;
    const lang: Lang = body.lang === "en" ? "en" : "ar";
    const lines: ChatLine[] = Array.isArray(body.lines)
      ? (body.lines as Array<{ role?: unknown; text?: unknown }>)
          .filter((l) => (l.role === "azm" || l.role === "user") && typeof l.text === "string")
          .slice(-MAX_LINES)
          .map((l) => ({ role: l.role as "azm" | "user", text: cleanText(l.text, 400) }))
          .filter((l) => l.text)
      : [];
    if (!lines.length) return NextResponse.json({ error: "empty conversation" }, { status: 400 });

    const active = await db.studySession.findFirst({
      where: { profileId: profile.id, status: "active" },
      orderBy: { startedAt: "desc" },
    });

    const result = await agentChat(resolveProvider(profile), {
      lang,
      personality: toPersonalityId(String(active?.personality ?? body.personality ?? "strict")),
      memory: await memoryTexts(profile.id, 12),
      session: active
        ? {
            active: true,
            goal: active.goal,
            task: active.task,
            focusedMin: Math.floor(active.focusedSeconds / 60),
          }
        : null,
      lines,
    });
    let memorySaved = false;
    if (result.remember) memorySaved = await addMemory(profile.id, result.remember, "agent");
    return NextResponse.json({ reply: result.reply, source: result.source, memorySaved });
  } catch {
    return NextResponse.json({ reply: "", source: "heuristic" }, { status: 200 });
  }
}
