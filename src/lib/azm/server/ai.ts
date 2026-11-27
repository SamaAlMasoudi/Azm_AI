/* Azm — server-side AI helpers: end-of-session dialogue + verification.
 * (Site/break justifications moved to agent.ts — the full conversation judge.)
 * Every call uses the student's chosen provider (built-in Z.AI or custom) and
 * falls back to honest heuristics marked "heuristic".
 */

import { cleanText } from "./profile";
import { chatJson, type ProviderConfig } from "./llm";
import type { Lang, Personality } from "../types";
import type { LevelProfile } from "../policy";

export type PersonalityId = "strict" | "friend" | "philosopher";

const PERSONA_NAME: Record<Personality, PersonalityId> = {
  strict: "strict",
  friend: "friend",
  philosopher: "philosopher",
};

export function toPersonalityId(p: string): PersonalityId {
  return PERSONA_NAME[p as Personality] ?? "strict";
}

const PERSONA_PROFILE: Record<PersonalityId, Record<Lang, string>> = {
  strict: {
    ar: "أنت «عزم»، شخصية المدرب الصارم: مباشر، حازم، محترم، بلا مجاملة ولا سخرية.",
    en: "You are 'Azm', the Strict Coach: direct, firm, respectful, no flattery or sarcasm.",
  },
  friend: {
    ar: "أنت «عزم»، شخصية الصديق الداعم: دافئ، مشجع، يحتفّ بالتقدم الحقيقي فقط.",
    en: "You are 'Azm', the Supportive Friend: warm, encouraging, celebrates only real progress.",
  },
  philosopher: {
    ar: "أنت «عزم»، شخصية الفيلسوف المنطقي: سقراطي هادئ، يجعل الطالب يزن كل قرار بثمنه من وقته.",
    en: "You are 'Azm', the Logical Philosopher: calm Socratic reasoning about the cost of every choice.",
  },
};

const BRAND_RULES: Record<Lang, string> = {
  ar: "قواعد: رسالتك جملة إلى جملتين، مباشرة، بلا لوم أو سخرية، عربي فصيح مبسّط.",
  en: "Rules: one or two short sentences, direct, never blaming or mocking.",
};

const clamp01 = (n: unknown, fallback = 0.5): number => {
  const v = typeof n === "number" ? n : parseFloat(String(n));
  if (Number.isNaN(v)) return fallback;
  return Math.max(0, Math.min(1, v));
};

const sanitizeMessage = (m: unknown, fallback: string): string => {
  const t = cleanText(m, 400);
  return t || fallback;
};

/* --------------------------- heuristic fallbacks --------------------------- */

export function heuristicEnd(
  focusedMinutes: number,
  plannedMinutes: number,
  hasPass: boolean,
  lang: Lang
): { action: "continue" | "allow_end" | "offer_break" | "use_pass"; message: string } {
  const halfDone = focusedMinutes >= plannedMinutes / 2;
  if (halfDone) {
    return {
      action: "allow_end",
      message:
        lang === "ar"
          ? "وقتٌ جيد من التركيز خلفك. إن كنت قد أنجزت النتيجة المتوقعة فلا بأس بالإنهاء — سأتحقق من إنجازك أولًا."
          : "A solid stretch of focus is behind you. If you achieved the expected outcome, ending is fine — I'll verify your achievement first.",
    };
  }
  if (focusedMinutes < 10) {
    return {
      action: "continue",
      message:
        lang === "ar"
          ? "بدأت للتو؛ أفضل إنجازاتك تبدأ بعد الدقائق الأولى. امنح المهمة عشر دقائق كاملة، ثم قرر."
          : "You just started; your best work begins after the first minutes. Give the task ten full minutes, then decide.",
    };
  }
  return {
    action: hasPass ? "use_pass" : "offer_break",
    message:
      lang === "ar"
        ? "لم تصل بعد إلى نصف الوقت المستهدف. إن كان التعب هو السبب فاستراحة قصيرة قد تكفي، وإن كان ظرفًا طارئًا فعندك تذكرة طوارئ."
        : "You haven't reached half your target time yet. If tiredness is the cause, a short break may be enough; if it's urgent, you have an emergency pass.",
  };
}

export function heuristicVerify(
  accomplishments: string,
  focusedMinutes: number,
  plannedMinutes: number,
  lang: Lang
): { verdict: "achieved" | "partial" | "not_achieved"; message: string } {
  const ratio = focusedMinutes / Math.max(1, plannedMinutes);
  const rich = accomplishments.trim().length >= 40;
  const verdict: "achieved" | "partial" | "not_achieved" =
    ratio >= 0.9 && rich ? "achieved" : ratio >= 0.5 ? "partial" : "not_achieved";
  const msgs = {
    ar: {
      achieved: "بناءً على وقتك ووصفك، الإنجاز موثّق. هذا ما ستشكرك عليه شجرة الصبر غدًا.",
      partial: "تقدّم حقيقي لكنه لم يكتمل. حدّد المتبقي بوضوح في جلستك القادمة وعُد أقوى.",
      not_achieved: "الوقت لا يكفي لتوثيق هذا الإنجاز. لا تحاسِب نفسك بلا رحمة — لكن ابدأ الدورة القادمة الآن.",
    },
    en: {
      achieved: "Based on your time and description, the achievement is documented. Your Sabr tree will thank you.",
      partial: "Real progress, but not complete. Define the remainder clearly next session and come back stronger.",
      not_achieved: "The time doesn't document this outcome yet. Don't judge yourself harshly — but start the next round now.",
    },
  } as const;
  return { verdict, message: msgs[lang][verdict] };
}

/* ------------------------------ AI decisions ------------------------------- */

export interface EndDecision {
  action: "continue" | "allow_end" | "offer_break" | "use_pass";
  message: string;
  source: "ai" | "heuristic";
}

export async function decideEnd(args: {
  cfg: ProviderConfig | null;
  lang: Lang;
  personality: PersonalityId;
  memory: string[];
  session: { goal: string; task: string; expectedOutcome: string; plannedMinutes: number; focusedMinutes: number; remainingMinutes: number; attempts: number };
  reason: string;
  hasPass: boolean;
}): Promise<EndDecision> {
  const { cfg, lang, personality, memory, session, reason, hasPass } = args;
  const system = [
    PERSONA_PROFILE[personality][lang],
    BRAND_RULES[lang],
    lang === "ar"
      ? "مهمتك: الحوار قبل إنهاء الجلسة. إن أنجز الطالب ما يكفي أو كان سبب الطلب مشروعًا → allow_end. إن بدا الطلب تعبًا مبكرًا → offer_break أو continue مع تشجيع محدد. لا تمنع الإنهاء قسرًا أبدًا."
      : "Handle the pre-end dialogue. If the student did enough or the reason is legitimate → allow_end. If it looks like early fatigue → offer_break or continue with specific encouragement. Never forcibly block ending.",
    lang === "ar"
      ? 'أعد JSON فقط: {"action":"continue|allow_end|offer_break|use_pass","message":"رسالتك بصوت شخصيتك"}'
      : 'Return JSON only: {"action":"continue|allow_end|offer_break|use_pass","message":"your message in your persona voice"}',
  ].join("\n\n");

  const user = [
    `goal: ${session.goal}`,
    `task: ${session.task}`,
    `expected_outcome: ${session.expectedOutcome}`,
    `focused_minutes: ${session.focusedMinutes}`,
    `planned_minutes: ${session.plannedMinutes}`,
    `distraction_attempts: ${session.attempts}`,
    `emergency_pass_available: ${hasPass}`,
    `Notes about the student: ${memory.slice(0, 10).join(" | ") || "none"}`,
    `reason_for_ending: ${reason}`,
  ].join("\n");

  const json = await chatJson(cfg, system, user, { maxTokens: 300 });
  const fb = heuristicEnd(session.focusedMinutes, session.plannedMinutes, hasPass, lang);
  if (json && ["continue", "allow_end", "offer_break", "use_pass"].includes(String(json.action))) {
    return {
      action: json.action as EndDecision["action"],
      message: sanitizeMessage(json.message, fb.message),
      confidence: clamp01(json.confidence, 0.6),
      source: "ai",
    } as EndDecision & { confidence?: number };
  }
  return { ...fb, source: "heuristic" };
}

export interface Verification {
  verdict: "achieved" | "partial" | "not_achieved";
  message: string;
  source: "ai" | "heuristic";
}

export async function verifyOutcome(args: {
  cfg: ProviderConfig | null;
  lang: Lang;
  personality: PersonalityId;
  memory: string[];
  expectedOutcome: string;
  accomplishments: string;
  focusedMinutes: number;
  plannedMinutes: number;
  blockedAttempts: number;
}): Promise<Verification> {
  const { cfg, lang, personality, memory, expectedOutcome, accomplishments, focusedMinutes, plannedMinutes, blockedAttempts } = args;
  const system = [
    PERSONA_PROFILE[personality][lang],
    BRAND_RULES[lang],
    lang === "ar"
      ? "مهمتك: التحقق بصدق من إنجاز الطالب مقارنة بالنتيجة المتوقعة، بمساعدة وقت التركيز ووصفه لما أنجزه. احتفِ بالإنجاز الحقيقي فقط، ولا تمدح بلا سبب."
      : "Honestly verify the student's achievement against the expected outcome, using focus time and their description. Celebrate only real achievement; never praise without reason.",
    lang === "ar"
      ? 'أعد JSON فقط: {"verdict":"achieved|partial|not_achieved","message":"رسالتك بصوت شخصيتك"}'
      : 'Return JSON only: {"verdict":"achieved|partial|not_achieved","message":"your message in your persona voice"}',
  ].join("\n\n");

  const user = [
    `expected_outcome: ${expectedOutcome}`,
    `accomplishments_claimed: ${accomplishments}`,
    `focused_minutes: ${focusedMinutes}`,
    `planned_minutes: ${plannedMinutes}`,
    `blocked_distraction_attempts: ${blockedAttempts}`,
    `Notes about the student: ${memory.slice(0, 10).join(" | ") || "none"}`,
  ].join("\n");

  const json = await chatJson(cfg, system, user, { maxTokens: 300 });
  const fb = heuristicVerify(accomplishments, focusedMinutes, plannedMinutes, lang);
  if (json && ["achieved", "partial", "not_achieved"].includes(String(json.verdict))) {
    return {
      verdict: json.verdict as Verification["verdict"],
      message: sanitizeMessage(json.message, fb.message),
      source: "ai",
    };
  }
  return { ...fb, source: "heuristic" };
}

/* ----------------------- level-aware nudges (voice) ------------------------ */

const NUDGES: Record<PersonalityId, Record<Lang, string[]>> = {
  strict: {
    ar: ["استمر. كل دقيقة تركيز الآن أرخص من ساعة مراجعة لاحقًا.", "لا شيء يغريك هنا — الهدف أولًا.", "أنت على المسار. لا تكسر الإيقاع."],
    en: ["Keep going. Every focused minute now is cheaper than an hour of revision later.", "Nothing here tempts you — goal first.", "You're on track. Don't break the rhythm."],
  },
  friend: {
    ar: ["أحسنت! أراك تحافظ على تركيزك — واصل.", "خطواتك الثابتة تفرق كثيرًا، صدقني.", "أنت أفضل بكثير من التشتت. واصل!"],
    en: ["Nice! You're protecting your focus — keep it up.", "Steady steps really add up, trust me.", "You're better than distraction. Keep going!"],
  },
  philosopher: {
    ar: ["التركيز رأس مالك الحقيقي؛ أنت تستثمره الآن بحكمة.", "من يملك دقائقه يملك نتائجه.", "الانضباط حرية: أنت تختار الهدف بدل أن تختارك الأداة."],
    en: ["Focus is your real capital; you're investing it wisely now.", "Who owns their minutes owns their results.", "Discipline is freedom: you choose the goal instead of the tool choosing you."],
  },
};

export function nudgeMessage(personality: PersonalityId, lang: Lang, salt: number): string {
  const pool = NUDGES[personality][lang];
  return pool[salt % pool.length]!;
}

export type { LevelProfile };
