import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { rankOf } from "@/lib/leaderboard.server";
import { sameOriginRequest, currentPlayer } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

/**
 * Submit a Journey run. Returns the player's weekly/monthly rank before and
 * after, plus whether this is a new all-time record.
 */
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  const current = await currentPlayer();
  if (!current) return NextResponse.json({ error: "Sign in to submit a ranked score." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const playerId = current.id;
  const xp = Math.max(0, Math.floor(Number(body.xp) || 0));
  const kills = Math.max(0, Math.floor(Number(body.kills) || 0));
  const zone = ["forest", "city", "hideout"].includes(body.zone) ? body.zone : "forest";
  const durationMs = Math.max(0, Math.floor(Number(body.durationMs) || 0));
  // sanity cap: 10 XP per kill, a human can't exceed ~5 kills/second
  if (xp > 20000 || xp !== kills * 10) return NextResponse.json({ error: "Rejected score" }, { status: 400 });

  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p) return NextResponse.json({ error: "Unknown player — sign up first" }, { status: 404 });

  const [weekBefore, monthBefore] = await Promise.all([rankOf(playerId, "weekly"), rankOf(playerId, "monthly")]);

  const prevRecord = p.sambisaHighscore;
  const isRecord = xp > prevRecord;

  await db.insert(scores).values({ playerId, xp, kills, zone, mode: "journey", durationMs });
  if (isRecord) {
    await db.update(players).set({ sambisaHighscore: sql`greatest(${players.sambisaHighscore}, ${xp})`, updatedAt: new Date() }).where(eq(players.id, playerId));
  }

  const [weekAfter, monthAfter, weekBest] = await Promise.all([
    rankOf(playerId, "weekly"),
    rankOf(playerId, "monthly"),
    db
      .select({ best: sql<number>`coalesce(max(${scores.xp}),0)`.mapWith(Number) })
      .from(scores)
      .where(eq(scores.playerId, playerId)),
  ]);

  return NextResponse.json({
    xp,
    kills,
    isRecord,
    prevRecord,
    weekBefore,
    weekAfter,
    monthBefore,
    monthAfter,
    allTimeBest: Math.max(weekBest[0]?.best ?? 0, xp),
  });
}
