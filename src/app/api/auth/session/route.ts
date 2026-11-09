import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth.server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ player: await currentPlayer() }, { headers: { "Cache-Control": "no-store" } });
}
