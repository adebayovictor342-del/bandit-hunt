import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed.server";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureSeeded();
  return NextResponse.json({ ok: true });
}
