import { sql } from "drizzle-orm";
import { db } from "@/db";
import { players, scores } from "@/db/schema";
import { DAY, monthStartOf, weekStartOf } from "./board";

/** Simulated rivals, same pool as the original AeroRank build. */
const POOL: [string, string, "male" | "female"][] = [
  ["Nova", "🦊", "female"], ["Kite", "🐼", "female"], ["Rex", "🐸", "male"], ["Juno", "🦄", "female"],
  ["Mako", "🐙", "male"], ["Pixel", "🐯", "female"], ["Sable", "🦉", "female"], ["Orbit", "🐧", "male"],
  ["Zed", "🐲", "male"], ["Lumi", "🦁", "female"], ["Bram", "🐨", "male"], ["Echo", "🐵", "male"],
  ["Vex", "🤖", "male"], ["Tango", "🦜", "female"], ["Rune", "🐺", "male"], ["Piper", "🦋", "female"],
  ["Hex", "🦈", "male"], ["Dash", "🐢", "male"], ["Cleo", "🐱", "female"], ["Otto", "🐻", "male"],
  ["Skye", "🦅", "female"], ["Fizz", "🐝", "female"], ["Yuki", "🐰", "female"], ["Blitz", "🦎", "male"],
];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seeded = false;

/** Idempotent: inserts the bot roster + runs for this week/month if the table is empty. */
export async function ensureSeeded() {
  if (seeded) return;
  const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(scores);
  if (n > 0) {
    seeded = true;
    return;
  }
  const now = Date.now();
  const wk = weekStartOf(now);
  const mo = monthStartOf(now);
  const rng = mulberry32(wk / DAY);
  const rows: (typeof scores.$inferInsert)[] = [];
  for (const [name, face, gender] of POOL) {
    const id = `bot_${name.toLowerCase()}`;
    await db
      .insert(players)
      .values({ id, name, gender, face })
      .onConflictDoNothing();
    // skill benchmark ~760 XP (76 kills); spread bots from 12 to 90 kills
    const skill = 12 + Math.floor(rng() * 78);
    const runs = 1 + Math.floor(rng() * 4);
    for (let r = 0; r < runs; r++) {
      const kills = Math.max(1, Math.round(skill * (0.55 + rng() * 0.5)));
      const earliest = Math.max(mo, now - 6 * DAY);
      const at = new Date(earliest + rng() * Math.max(1, now - earliest - 60_000));
      rows.push({ playerId: id, xp: kills * 10, kills, zone: ["forest", "city", "hideout"][Math.floor(rng() * 3)], mode: "journey", durationMs: 90_000 + Math.floor(rng() * 60_000), createdAt: at });
    }
    // a couple of older monthly-only runs for some bots
    if (rng() < 0.5 && mo < now - 8 * DAY) {
      const kills = Math.max(1, Math.round(skill * (0.7 + rng() * 0.6)));
      rows.push({ playerId: id, xp: kills * 10, kills, zone: "forest", mode: "journey", durationMs: 120_000, createdAt: new Date(mo + rng() * Math.max(1, wk - mo)) });
    }
  }
  if (rows.length) await db.insert(scores).values(rows);
  seeded = true;
}
