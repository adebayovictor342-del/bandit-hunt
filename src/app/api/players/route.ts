import { NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { battles, players, scores } from "@/db/schema";
import { sameOriginRequest, cleanName, currentPlayer } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

/** Update only the signed-in fighter, never an arbitrary player id. */
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  const current = await currentPlayer();
  if (!current) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = cleanName(body.name);
  const gender = body.gender === "female" ? "female" : "male";
  if (name.length < 2) return NextResponse.json({ error: "Callsign must be at least 2 characters." }, { status: 400 });
  const face = gender === "female" ? "👩‍🚀" : "👨‍🚀";
  await db.update(players).set({ name, gender, face, updatedAt: new Date() }).where(eq(players.id, current.id));
  return NextResponse.json({ player: { ...current, name, gender, face } });
}

export async function GET() {
  const p = await currentPlayer();
  if (!p) return NextResponse.json({ error: "Sign in to see your profile." }, { status: 401 });
  const [recent, recentBattles, aggregate] = await Promise.all([
    db.select().from(scores).where(eq(scores.playerId, p.id)).orderBy(desc(scores.createdAt)).limit(10),
    db.select().from(battles).where(eq(battles.playerId, p.id)).orderBy(desc(battles.createdAt)).limit(10),
    db.select({ matches: sql<number>`count(*)`.mapWith(Number), wins: sql<number>`coalesce(sum(${battles.won}),0)`.mapWith(Number) }).from(battles).where(eq(battles.playerId, p.id)),
  ]);
  return NextResponse.json({ player: p, recent, recentBattles, stats: aggregate[0] ?? { matches: 0, wins: 0 } });
}
