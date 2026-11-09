import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { billboardCreatives } from "@/db/schema";
import { ensureAdminTables, normaliseAdminCreatives, readOnlineAnalytics, updateBillboardCreatives, verifyAdminCookie, adminCookieName } from "@/lib/admin.server";
import { sameOriginRequest } from "@/lib/auth.server";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function authorised() {
  const jar = await cookies();
  return verifyAdminCookie(jar.get(adminCookieName())?.value);
}

export async function GET() {
  if (!await authorised()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  await ensureAdminTables();
  const [rows, analytics] = await Promise.all([
    db.select().from(billboardCreatives).orderBy(asc(billboardCreatives.slot), asc(billboardCreatives.creativeIndex)),
    readOnlineAnalytics(),
  ]);
  const campaigns = Array.from({ length: 5 }, (_, slotIndex) =>
    Array.from({ length: 4 }, (_, creativeIndex) => {
      const row = rows.find((creative) => creative.slot === slotIndex + 1 && creative.creativeIndex === creativeIndex);
      return row ? {
        slot: row.slot, creativeIndex: row.creativeIndex, image: row.image, video: row.video,
        destination: row.destination, title: row.title, campaign: row.campaign,
      } : {
        slot: slotIndex + 1, creativeIndex, image: "", video: "", destination: "", title: "",
        campaign: `billboard-${slotIndex + 1}-ad-${creativeIndex + 1}`,
      };
    }),
  );
  return NextResponse.json({ campaigns, analytics }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!await authorised()) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  let body: { campaigns?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid billboard settings." }, { status: 400 });
  }
  const creatives = normaliseAdminCreatives(body.campaigns);
  if (!creatives) {
    return NextResponse.json({
      error: "Use five billboards with four ads each. Ads need an HTTPS or local creative URL, safe HTTPS landing pages, and unique campaign IDs.",
    }, { status: 400 });
  }
  await updateBillboardCreatives(creatives);
  return NextResponse.json({ ok: true });
}
