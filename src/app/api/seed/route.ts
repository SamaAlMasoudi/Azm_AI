/* Seed demo data for THIS profile only (clearly-labeled fake sessions for analytics) */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { subDays } from "date-fns";

export const runtime = "nodejs";

const DEMO_SESSIONS: {
  daysAgo: number;
  goal: string;
  task: string;
  outcome: string;
  work: number;
  focusedSec: number;
  attempts: number;
  blocked: number;
  approved: number;
  uncertain: number;
  verdict: string;
}[] = [
  { daysAgo: 6, goal: "التحضير لاختبار الأحياء", task: "مراجعة درس التمثيل الضوئي", outcome: "فهم الدرس وحل 15 سؤالًا", work: 25, focusedSec: 50 * 60, attempts: 3, blocked: 2, approved: 1, uncertain: 0, verdict: "achieved" },
  { daysAgo: 5, goal: "مشروع تخرج — تحليل البيانات", task: "تنظيف البيانات", outcome: "إكمال تنظيف 80% من البيانات", work: 52, focusedSec: 90 * 60, attempts: 2, blocked: 1, approved: 1, uncertain: 0, verdict: "partial" },
  { daysAgo: 4, goal: "مساق Coursera — مقدمة إحصاء", task: "مشاهدة محاضرة الأسبوع 3", outcome: "إنهاء المحاضرة والاختبار القصير", work: 25, focusedSec: 75 * 60, attempts: 1, blocked: 1, approved: 0, uncertain: 0, verdict: "achieved" },
  { daysAgo: 3, goal: "التاريخ — الأندلس", task: "تلخيص الفصل الرابع", outcome: "ملخص من صفحتين", work: 25, focusedSec: 40 * 60, attempts: 5, blocked: 3, approved: 1, uncertain: 1, verdict: "partial" },
  { daysAgo: 2, goal: "البرمجة — React", task: "بناء مكوّن لوحة التحكم", outcome: "مكوّن يعمل مع حالة كاملة", work: 52, focusedSec: 110 * 60, attempts: 2, blocked: 2, approved: 0, uncertain: 0, verdict: "achieved" },
  { daysAgo: 1, goal: "الرياضيات — التكامل", task: "حل مجموعة تمارين", outcome: "حل 12 تمرينًا", work: 25, focusedSec: 65 * 60, attempts: 3, blocked: 2, approved: 1, uncertain: 0, verdict: "achieved" },
  { daysAgo: 0, goal: "اللغة الإنجليزية — IELTS", task: "تدريب قراءة", outcome: "قطعتان مع الأسئلة", work: 25, focusedSec: 30 * 60, attempts: 2, blocked: 1, approved: 0, uncertain: 1, verdict: "partial" },
];

const DEMO_INTERVENTIONS: { site: string; url: string; cat: string; verdict: string; cls: string; msg: string }[] = [
  { site: "X (تويتر)", url: "x.com", cat: "social", verdict: "rejected", cls: "distracting", msg: "لم أقتنع هذه المرة. سنعود إلى هدفك." },
  { site: "يوتيوب", url: "youtube.com/watch?v=v-goals5", cat: "entertainment", verdict: "timeout", cls: "distracting", msg: "انتهت المهلة بلا تبرير. سنعود إلى هدفك." },
  { site: "ويكيبيديا", url: "wikipedia.org/wiki/Chlorophyll", cat: "reference", verdict: "approved", cls: "supportive", msg: "حجّتك مقنعة. المعرفة مشروعة كلما خدمت الغاية." },
  { site: "يلا كورة", url: "yallakora.com", cat: "sports", verdict: "rejected", cls: "distracting", msg: "هذا تشتيت بأداة أنيقة. لنجعل الدورة القادمة تُحسب لصالحك." },
  { site: "نتفليكس", url: "netflix.com", cat: "entertainment", verdict: "rejected", cls: "distracting", msg: "الترفيه لحظة، والإنجاز عمر." },
  { site: "ChatGPT", url: "chatgpt.com", cat: "ai_tool", verdict: "approved", cls: "supportive", msg: "منطقي ومرتبط بهدفك. مسموح — وبتوقيت قصير." },
  { site: "X (تويتر)", url: "x.com", cat: "social", verdict: "self_corrected", cls: "none", msg: "" },
  { site: "إنستغرام", url: "instagram.com", cat: "social", verdict: "rejected", cls: "distracting", msg: "تبريرك ضعيف مقابل ثمنه من وقتك." },
];

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    for (const ds of DEMO_SESSIONS) {
      const startedAt = subDays(new Date(), ds.daysAgo);
      startedAt.setHours(16 + (ds.daysAgo % 4), 0, 0, 0);
      const session = await db.studySession.create({
        data: {
          profileId: profile.id,
          goal: ds.goal,
          task: ds.task,
          expectedOutcome: ds.outcome,
          technique: "pomodoro",
          workMinutes: ds.work,
          breakMinutes: 5,
          personality: "strict",
          level: "balanced",
          allowedSites: "[]",
          status: "ended",
          startedAt,
          endedAt: new Date(startedAt.getTime() + ds.focusedSec * 1000),
          focusedSeconds: ds.focusedSec,
          breakSeconds: 5 * 60,
          distractionAttempts: ds.attempts,
          interventionsBlocked: ds.blocked,
          interventionsApproved: ds.approved,
          interventionsUncertain: ds.uncertain,
          rounds: Math.max(1, Math.floor(ds.focusedSec / (ds.work * 60))),
          treeStage: Math.min(5, Math.floor(ds.focusedSec / 60 / 21)),
          verificationVerdict: ds.verdict,
          verificationMessage: "بيانات تجريبية لاستعراض الإحصاءات",
        },
      });
      const di = DEMO_INTERVENTIONS[ds.daysAgo % DEMO_INTERVENTIONS.length];
      await db.intervention.create({
        data: {
          profileId: profile.id,
          sessionId: session.id,
          siteName: di.site,
          siteUrl: di.url,
          category: di.cat,
          explanation: di.verdict === "approved" ? "أبحث عن تعريف مصطلح ورد في المحاضرة" : "",
          verdict: di.verdict,
          classification: di.cls,
          aiMessage: di.msg,
          confidence: di.verdict === "approved" ? 0.8 : 0.7,
          source: "link",
          aiSource: "heuristic",
          createdAt: new Date(startedAt.getTime() + Math.floor(ds.focusedSec / 2) * 1000),
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
