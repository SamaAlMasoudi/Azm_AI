/* Analytics summary (profile-scoped): week + totals + 7-day chart + recent interventions */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile } from "@/lib/azm/server/profile";
import { getISOWeek, startOfISOWeek, subDays, format } from "date-fns";
import type { AnalyticsSummary } from "@/lib/azm/types";

export const runtime = "nodejs";

const SAVED_HOURS_PER_BLOCK = 0.1; // ~6 minutes protected per blocked attempt

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const now = new Date();
    const weekStart = startOfISOWeek(now);
    const weekKey = `${weekStart.getFullYear()}-W${String(getISOWeek(now)).padStart(2, "0")}`;

    const sessions = await db.studySession.findMany({
      where: { profileId: profile.id, status: "ended" },
    });
    const interventions = await db.intervention.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const inWeek = sessions.filter((s) => s.startedAt >= weekStart);
    const interventionsWeek = interventions.filter((i) => i.createdAt >= weekStart);

    const focusedSecondsWeek = inWeek.reduce((acc, s) => acc + s.focusedSeconds, 0);
    const blockedWeek = inWeek.reduce((acc, s) => acc + s.interventionsBlocked, 0);
    const approvedWeek = interventionsWeek.filter((i) => i.verdict === "approved").length;
    const uncertainWeek = inWeek.reduce((acc, s) => acc + s.interventionsUncertain, 0);
    const attemptsWeek = inWeek.reduce((acc, s) => acc + s.distractionAttempts, 0);
    const selfCorrectedWeek = interventionsWeek.filter((i) => i.verdict === "self_corrected").length;

    const focusedHoursTotal = sessions.reduce((acc, s) => acc + s.focusedSeconds, 0) / 3600;
    const blockedTotal = sessions.reduce((acc, s) => acc + s.interventionsBlocked, 0);

    const savedHoursWeek = focusedSecondsWeek / 3600 + blockedWeek * SAVED_HOURS_PER_BLOCK;

    const daily: { date: string; focusedMinutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i);
      const key = format(day, "yyyy-MM-dd");
      const mins = sessions
        .filter((s) => format(s.startedAt, "yyyy-MM-dd") === key)
        .reduce((acc, s) => acc + s.focusedSeconds, 0) / 60;
      daily.push({ date: key, focusedMinutes: Math.round(mins) });
    }

    const summary: AnalyticsSummary = {
      week: {
        weekKey,
        sessions: inWeek.length,
        focusedHours: Math.round((focusedSecondsWeek / 3600) * 10) / 10,
        savedHours: Math.round(savedHoursWeek * 10) / 10,
        attempts: attemptsWeek,
        blocked: blockedWeek,
        approved: approvedWeek,
        uncertain: uncertainWeek,
        selfCorrected: selfCorrectedWeek,
      },
      total: {
        sessions: sessions.length,
        focusedHours: Math.round(focusedHoursTotal * 10) / 10,
        attempts: sessions.reduce((acc, s) => acc + s.distractionAttempts, 0),
        blocked: blockedTotal,
        approved: sessions.reduce((acc, s) => acc + s.interventionsApproved, 0),
        uncertain: sessions.reduce((acc, s) => acc + s.interventionsUncertain, 0),
      },
      daily,
      recent: interventions.map((i) => ({
        id: i.id,
        sessionId: i.sessionId,
        siteName: i.siteName,
        siteUrl: i.siteUrl,
        category: i.category,
        explanation: i.explanation,
        verdict: i.verdict as AnalyticsSummary["recent"][number]["verdict"],
        classification: i.classification as AnalyticsSummary["recent"][number]["classification"],
        aiMessage: i.aiMessage,
        confidence: i.confidence,
        source: i.source,
        aiSource: i.aiSource,
        createdAt: i.createdAt.toISOString(),
      })),
      passUsedThisWeek: Boolean(
        await db.emergencyPass.findFirst({ where: { weekKey, profileId: profile.id } })
      ),
    };

    return NextResponse.json(summary);
  } catch {
    const empty: AnalyticsSummary = {
      week: { weekKey: "-", sessions: 0, focusedHours: 0, savedHours: 0, attempts: 0, blocked: 0, approved: 0, uncertain: 0, selfCorrected: 0 },
      total: { sessions: 0, focusedHours: 0, attempts: 0, blocked: 0, approved: 0, uncertain: 0 },
      daily: Array.from({ length: 7 }, (_, i) => ({ date: format(subDays(new Date(), 6 - i), "yyyy-MM-dd"), focusedMinutes: 0 })),
      recent: [],
      passUsedThisWeek: false,
    };
    return NextResponse.json(empty);
  }
}
