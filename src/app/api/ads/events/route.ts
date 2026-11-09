import { NextResponse } from "next/server";
import { db } from "@/db";
import { adEvents } from "@/db/schema";
import { activeCreativeIndex, activeBillboardCreative, readBillboardCreatives } from "@/lib/admin.server";
import { sameOriginRequest } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    const value: unknown = await req.json();
    if (!value || typeof value !== "object") return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  const slot = Number(body.slot);
  const creativeIndex = Number(body.creativeIndex);
  if (!Number.isInteger(slot) || slot < 1 || slot > 5
    || !Number.isInteger(creativeIndex) || creativeIndex < 0 || creativeIndex > 3
    || (body.kind !== "impression" && body.kind !== "click")
    || typeof body.campaign !== "string") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (body.kind === "impression") {
    const rows = await readBillboardCreatives();
    if (creativeIndex !== activeCreativeIndex(rows, slot)) {
      return NextResponse.json({ error: "Expired impression" }, { status: 400 });
    }
  }
  const creative = await activeBillboardCreative(slot, creativeIndex);
  if (!creative || body.campaign !== creative.campaign) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  await db.insert(adEvents).values({ campaign: creative.campaign, kind: body.kind });
  return NextResponse.json({ ok: true });
}
