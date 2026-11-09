import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { billboardCreatives, onlineSamples, onlineVisitors } from "@/db/schema";
import { billboardCampaign } from "@/lib/advertisement.server";

const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sambisa_admin" : "sambisa_admin";
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const ONLINE_SECONDS = 90;
const CREATIVE_PERIOD_MS = 10_000;

let tablesReady: Promise<void> | null = null;

export function adminCookieName() {
  return ADMIN_COOKIE;
}

function hmac(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function signatureMatches(value: string, signature: string) {
  const expected = Buffer.from(hmac(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyAdminCookie(value: string | undefined) {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET || !value) return false;
  const [expires, signature, extra] = value.split(".");
  if (extra || !/^\d+$/.test(expires ?? "") || !signature) return false;
  const expiry = Number(expires);
  return expiry > Math.floor(Date.now() / 1000)
    && expiry <= Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS + 60
    && signatureMatches(expires, signature);
}

export function createAdminCookieValue() {
  const expires = String(Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS);
  return `${expires}.${hmac(expires)}`;
}

export function verifyAdminPassword(input: unknown) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof input !== "string") return false;
  const actualHash = createHmac("sha256", "sambisa-admin-password-check").update(input).digest();
  const expectedHash = createHmac("sha256", "sambisa-admin-password-check").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function ensureAdminTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS billboard_creatives (
          slot integer NOT NULL,
          creative_index integer NOT NULL,
          image_url varchar(2048) NOT NULL DEFAULT '',
          video_url varchar(2048) NOT NULL DEFAULT '',
          destination_url varchar(2048) NOT NULL DEFAULT '',
          title varchar(80) NOT NULL DEFAULT '',
          campaign_id varchar(80) NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (slot, creative_index)
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS billboard_creatives_campaign_idx ON billboard_creatives (campaign_id)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS online_visitors (
          id varchar(64) PRIMARY KEY,
          last_seen timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS online_visitors_last_seen_idx ON online_visitors (last_seen)`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS online_samples (
          minute timestamptz PRIMARY KEY,
          active integer NOT NULL
        )
      `);
      const existing = await db.select({ slot: billboardCreatives.slot }).from(billboardCreatives).limit(1);
      if (existing.length === 0) {
        const seeds = [];
        for (let slot = 1; slot <= 5; slot++) {
          for (let creativeIndex = 0; creativeIndex < 4; creativeIndex++) {
            const campaign = creativeIndex === 0 ? billboardCampaign(slot) : null;
            seeds.push({
              slot,
              creativeIndex,
              image: campaign?.image ?? "",
              video: campaign?.video ?? "",
              destination: campaign?.destination ?? "",
              title: campaign?.title ?? "",
              campaign: campaign?.campaign ?? `billboard-${slot}-ad-${creativeIndex + 1}`,
            });
          }
        }
        await db.insert(billboardCreatives).values(seeds).onConflictDoNothing();
      }
    })().catch((error: unknown) => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}

export type AdminCreative = {
  slot: number;
  creativeIndex: number;
  image: string;
  video: string;
  destination: string;
  title: string;
  campaign: string;
};

export async function readBillboardCreatives() {
  await ensureAdminTables();
  const rows = await db.select().from(billboardCreatives).orderBy(asc(billboardCreatives.slot), asc(billboardCreatives.creativeIndex));
  return rows;
}

export async function activeBillboardCreative(slot: number, creativeIndex: number) {
  await ensureAdminTables();
  const rows = await db.select().from(billboardCreatives)
    .where(and(eq(billboardCreatives.slot, slot), eq(billboardCreatives.creativeIndex, creativeIndex))).limit(1);
  const row = rows[0];
  if (!row || (!row.image && !row.video)) return null;
  return {
    slot: row.slot,
    creativeIndex: row.creativeIndex,
    image: row.image || null,
    video: row.video || null,
    destination: row.destination,
    title: row.title || "Sponsored message",
    campaign: row.campaign,
  };
}

export function activeCreativeIndex(
  rows: { slot: number; creativeIndex: number; image: string; video: string }[],
  slot: number,
  now = Date.now(),
) {
  const active = rows.filter((row) => row.slot === slot && (row.image || row.video));
  if (!active.length) return null;
  return active[Math.floor(now / CREATIVE_PERIOD_MS) % active.length].creativeIndex;
}

export function nextCreativeRotation(now = Date.now()) {
  return (Math.floor(now / CREATIVE_PERIOD_MS) + 1) * CREATIVE_PERIOD_MS;
}

export async function recordOnlineVisitor(id: string) {
  await ensureAdminTables();
  const now = new Date();
  await db.insert(onlineVisitors).values({ id, lastSeen: now })
    .onConflictDoUpdate({ target: onlineVisitors.id, set: { lastSeen: now } });
  const cutoff = new Date(now.getTime() - ONLINE_SECONDS * 1000);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(onlineVisitors)
    .where(gt(onlineVisitors.lastSeen, cutoff));
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  await db.insert(onlineSamples).values({ minute, active: count.total })
    .onConflictDoUpdate({ target: onlineSamples.minute, set: { active: count.total } });
  await db.delete(onlineVisitors).where(lt(onlineVisitors.lastSeen, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
  await db.delete(onlineSamples).where(lt(onlineSamples.minute, new Date(now.getTime() - 24 * 60 * 60 * 1000)));
}

export async function readOnlineAnalytics() {
  await ensureAdminTables();
  const now = new Date();
  const cutoff = new Date(now.getTime() - ONLINE_SECONDS * 1000);
  const [current] = await db.select({ total: sql<number>`count(*)::int` }).from(onlineVisitors)
    .where(gt(onlineVisitors.lastSeen, cutoff));
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  await db.insert(onlineSamples).values({ minute, active: current.total })
    .onConflictDoUpdate({ target: onlineSamples.minute, set: { active: current.total } });
  const samples = await db.select({ minute: onlineSamples.minute, active: onlineSamples.active })
    .from(onlineSamples).where(gte(onlineSamples.minute, new Date(now.getTime() - 60 * 60 * 1000)))
    .orderBy(asc(onlineSamples.minute));
  return { online: current.total, samples: samples.map((sample) => ({ time: sample.minute.getTime(), active: sample.active })) };
}

export function normaliseAdminCreatives(input: unknown): AdminCreative[] | null {
  if (!Array.isArray(input) || input.length !== 5) return null;
  const output: AdminCreative[] = [];
  const campaignIds = new Set<string>();
  const safeCreative = (value: unknown) => {
    if (typeof value !== "string" || value.length > 2048) return null;
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
    try {
      const url = new URL(trimmed);
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };
  const safeDestination = (value: unknown) => {
    if (typeof value !== "string" || value.length > 2048) return null;
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
      const url = new URL(trimmed);
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };

  for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
    const slotAds = input[slotIndex];
    if (!Array.isArray(slotAds) || slotAds.length !== 4) return null;
    for (let creativeIndex = 0; creativeIndex < 4; creativeIndex++) {
      const value = slotAds[creativeIndex];
      if (!value || typeof value !== "object") return null;
      const ad = value as Record<string, unknown>;
      const image = safeCreative(ad.image);
      const video = safeCreative(ad.video);
      const destination = safeDestination(ad.destination);
      const title = typeof ad.title === "string" ? ad.title.trim().slice(0, 80) : null;
      const campaign = typeof ad.campaign === "string" ? ad.campaign.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) : null;
      if (image === null || video === null || destination === null || title === null || campaign === null) return null;
      if ((image || video) && !campaign) return null;
      if (campaign && campaignIds.has(campaign)) return null;
      if (campaign) campaignIds.add(campaign);
      output.push({
        slot: slotIndex + 1,
        creativeIndex,
        image,
        video,
        destination,
        title,
        campaign: campaign || `billboard-${slotIndex + 1}-ad-${creativeIndex + 1}`,
      });
    }
  }
  return output;
}

export function newPresenceId() {
  return randomBytes(32).toString("base64url");
}

export async function updateBillboardCreatives(creatives: AdminCreative[]) {
  await ensureAdminTables();
  await db.transaction(async (tx) => {
    await tx.delete(billboardCreatives);
    await tx.insert(billboardCreatives).values(creatives);
  });
}
