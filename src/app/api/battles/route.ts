import { NextResponse } from "next/server";
import { db } from "@/db";
import { battles } from "@/db/schema";
import { sameOriginRequest, currentPlayer } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

/** Record an unranked Battle Mode result (history only — never touches the prize boards). */
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  const current = await currentPlayer();
  if (!current) return NextResponse.json({ error: "Sign in to save battle history." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const playerId = current.id;
  try {
    await db.insert(battles).values({
      playerId,
      format: body.format === "1v1" ? "1v1" : "2v2",
      zone: ["forest", "city", "hideout"].includes(body.zone) ? body.zone : "forest",
      won: body.won ? 1 : 0,
      netScore: Math.floor(Number(body.netScore) || 0),
      mmrDelta: Math.floor(Number(body.mmrDelta) || 0),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
