import { sql } from "drizzle-orm";
import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { periodRange, type BoardEntry, type BoardResponse, type Period } from "./board";

/** Best ranked Journey run per fighter. Ties belong to whoever reached the score first. */
export async function buildBoard(period: Period, youId: string | null, limit = 50): Promise<BoardResponse> {
  const { start, end } = periodRange(period);
  const startD = new Date(start), endD = new Date(end);
  const rows = await db.execute<{
    playerId: string; name: string; face: string; gender: string; xp: number; kills: number; runs: string | number;
  }>(sql`
    WITH ranked_runs AS (
      SELECT ${scores.playerId} AS player_id, ${scores.xp} AS xp, ${scores.kills} AS kills,
             ${scores.createdAt} AS achieved_at,
             row_number() OVER (PARTITION BY ${scores.playerId} ORDER BY ${scores.xp} DESC, ${scores.createdAt} ASC, ${scores.id} ASC) AS best_run,
             count(*) OVER (PARTITION BY ${scores.playerId}) AS runs
      FROM ${scores}
      WHERE ${scores.mode} = 'journey' AND ${scores.createdAt} >= ${startD} AND ${scores.createdAt} < ${endD}
    )
    SELECT p.id AS "playerId", p.name, p.face, p.gender, r.xp, r.kills, r.runs
    FROM ranked_runs r INNER JOIN ${players} p ON p.id = r.player_id
    WHERE r.best_run = 1
    ORDER BY r.xp DESC, r.achieved_at ASC, p.id ASC
  `);
  const all: BoardEntry[] = rows.rows.map((r, i) => ({
    rank: i + 1, playerId: r.playerId, name: r.name, face: r.face, gender: r.gender,
    xp: Number(r.xp), kills: Number(r.kills), runs: Number(r.runs), you: !!youId && r.playerId === youId,
  }));
  return { period, periodStart: startD.toISOString(), periodEnd: endD.toISOString(), entries: all.slice(0, limit), you: all.find((e) => e.you) ?? null, total: all.length };
}
export async function rankOf(playerId: string, period: Period): Promise<number | null> {
  return (await buildBoard(period, playerId, 1)).you?.rank ?? null;
}
