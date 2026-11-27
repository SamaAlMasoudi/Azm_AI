/* Free conversation with Azm — streamed (SSE) for OpenAI-compatible providers
 * (Groq, Ollama, OpenAI gateways); buffered single-chunk for builtin/Anthropic.
 * Same persona + memory context as /api/ai/chat. Memory saving works in both
 * modes: streamed replies may end with a "Remember: …" line which the server
 * strips out and stores before flushing the final event. */

import { getOrCreateProfile, cleanText, rateLimit } from "@/lib/azm/server/profile";
import { resolveProvider, streamChat } from "@/lib/azm/server/llm";
import { PERSONA, RULES, type ChatLine } from "@/lib/azm/server/agent";
import { toPersonalityId } from "@/lib/azm/server/ai";
import { memoryTexts, addMemory } from "@/lib/azm/server/pipeline";
import { db } from "@/lib/db";
import type { Lang } from "@/lib/azm/types";

export const runtime = "nodejs";

const MAX_LINES = 12;

function sse(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: Request) {
  const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
  if (!rateLimit(`chat:${profile.id}`, 20, 10_000)) {
    return new Response(JSON.stringify({ error: "too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  const lang: Lang = body.lang === "en" ? "en" : "ar";
  const lines: ChatLine[] = Array.isArray(body.lines)
    ? (body.lines as Array<{ role?: unknown; text?: unknown }>)
        .filter((l) => (l.role === "azm" || l.role === "user") && typeof l.text === "string")
        .slice(-MAX_LINES)
        .map((l) => ({ role: l.role as "azm" | "user", text: cleanText(l.text, 400) }))
        .filter((l) => l.text)
    : [];
  if (!lines.length) {
    return new Response(JSON.stringify({ error: "empty conversation" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const active = await db.studySession.findFirst({
    where: { profileId: profile.id, status: "active" },
    orderBy: { startedAt: "desc" },
  });

  const personality = toPersonalityId(String(active?.personality ?? body.personality ?? "strict"));
  const memory = await memoryTexts(profile.id, 12);

  const system = [
    PERSONA[personality][lang],
    RULES[lang],
    lang === "ar"
      ? "أنت الآن في حوار حر مع الطالب (زر «تحدث مع عزم»). أجب في جملة إلى جملتين، وكن صديقاً محاسباً يذكّر بالهدف ويقترح الخطوة التالية. إن كشف الطالب معلومة دائمة عن دراسته اكتب في سطر أخير منفصل: «تذكّر: المعلومة»."
      : "You are now in a free conversation with the student (the 'Talk to Azm' button). Answer in one or two sentences; be a friendly accountability partner who recalls the goal and suggests the next step. If the student reveals a durable fact about their studies, add a separate last line: 'Remember: the fact'.",
  ].join("\n\n");

  const user = [
    active
      ? `Session: active — goal: ${active.goal} — task: ${active.task} — focused ${Math.floor(active.focusedSeconds / 60)} min.`
      : "Session: none right now.",
    `Notes about the student: ${memory.slice(0, 12).join(" | ") || "none"}`,
    "<conversation>",
    lines.slice(-8).map((l) => (l.role === "azm" ? `Azm: ${l.text}` : `Student: ${l.text}`)).join("\n") || "(empty)",
    "</conversation>",
  ].join("\n");

  const cfg = resolveProvider(profile);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(sse(payload)));
        } catch {
          /* client disconnected */
        }
      };
      let full = "";
      try {
        if (!cfg) {
          const fb = lang === "ar"
            ? "أنا معك. حدّد مزود ذكاء اصطناعي في الإعدادات، أو سأجيبك بقواعد محلية بسيطة."
            : "I'm with you. Pick an AI provider in Settings, or I'll answer with simple local rules.";
          send({ delta: fb, source: "heuristic" });
          send({ done: true, reply: fb, source: "heuristic" });
        } else {
          send({ start: true, provider: cfg.kind, model: cfg.model, streaming: cfg.kind !== "builtin" && cfg.kind !== "anthropic" });
          for await (const chunk of streamChat(cfg, system, user, { maxTokens: 400, temperature: 0.4, timeoutMs: 30_000 })) {
            full += chunk.delta;
            send({ delta: chunk.delta });
          }
          // parse + strip the optional memory line before finalizing
          let remembered = "";
          const mark = lang === "ar" ? "تذكّر:" : "Remember:";
          const idx = full.lastIndexOf(mark);
          if (idx !== -1) {
            remembered = full.slice(idx + mark.length, full.length).trim().slice(0, 160);
            full = full.slice(0, idx).trim();
          }
          let memorySaved = false;
          if (remembered) memorySaved = await addMemory(profile.id, remembered, "agent");
          send({ done: true, reply: full, source: "ai", memorySaved });
        }
      } catch (e) {
        const msg = (e as Error).message || "stream failed";
        send({ error: msg });
        send({ done: true, error: msg, source: "heuristic" });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
