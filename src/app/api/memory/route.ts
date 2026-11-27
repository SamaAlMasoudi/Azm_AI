/* AI Memory — what Azm remembers about the student (CRUD). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOrCreateProfile, cleanText } from "@/lib/azm/server/profile";
import { addMemory } from "@/lib/azm/server/pipeline";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const items = await db.memoryItem.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return NextResponse.json({
      memory: items.map((m) => ({ id: m.id, text: m.text, source: m.source, createdAt: m.createdAt.toISOString() })),
    });
  } catch {
    return NextResponse.json({ memory: [] });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const body = (await req.json()) as { text?: unknown };
    const ok = await addMemory(profile.id, cleanText(body.text, 200), "user");
    if (!ok) return NextResponse.json({ error: "empty or duplicate note" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed to save note" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profile = await getOrCreateProfile(req.headers.get("x-azm-profile"));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") ?? "";
    await db.memoryItem.deleteMany({ where: { id, profileId: profile.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed to delete note" }, { status: 500 });
  }
}
