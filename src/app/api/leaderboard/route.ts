import { NextResponse } from "next/server";
import { buildBoard } from "@/lib/leaderboard.server";
import type { Period } from "@/lib/board";
import { ensureSeeded } from "@/lib/seed.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get("period");
  const period: Period = p === "monthly" || p === "alltime" ? p : "weekly";
  const you = url.searchParams.get("you");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  try {
    await ensureSeeded();
    const board = await buildBoard(period, you, limit);
    return NextResponse.json(board);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
