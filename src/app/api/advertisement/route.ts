import { NextResponse } from "next/server";
import {
  activeCreativeIndex,
  nextCreativeRotation,
  readBillboardCreatives,
} from "@/lib/admin.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const serverTime = Date.now();
  const rotationTick = Math.floor(serverTime / 10_000);
  const rows = await readBillboardCreatives();
  const campaigns = Array.from({ length: 5 }, (_, slotIndex) => {
    const creativeIndex = activeCreativeIndex(rows, slotIndex + 1, serverTime);
    const row = rows.find((creative) => creative.slot === slotIndex + 1 && creative.creativeIndex === creativeIndex);
    const campaign = row && (row.image || row.video) ? {
      slot: row.slot,
      creativeIndex: row.creativeIndex,
      rotationTick,
      image: row.image || null,
      video: row.video || null,
      destination: row.destination,
      title: row.title || "Sponsored message",
      campaign: row.campaign,
    } : null;
    return { slot: slotIndex + 1, campaign };
  });
  return NextResponse.json({
    campaigns,
    serverTime,
    nextRotationAt: nextCreativeRotation(serverTime),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
