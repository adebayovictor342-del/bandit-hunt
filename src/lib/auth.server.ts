import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { players, sessions } from "@/db/schema";

const production = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = production ? "__Host-sambisa_session" : "sambisa_session";
const LEGACY_COOKIE = "sambisa_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key as Buffer));
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [type, salt, hex] = stored.split("$");
  if (type !== "scrypt" || !salt || !hex || !/^[a-f0-9]+$/i.test(hex)) return false;
  const actual = await derive(password, salt);
  const expected = Buffer.from(hex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newPlayerId = () => randomUUID();
export const normaliseEmail = (email: unknown) => String(email ?? "").trim().toLowerCase().slice(0, 254);
export const cleanName = (name: unknown) => String(name ?? "").replace(/[^\w .-]/g, "").trim().slice(0, 24);

export async function createSession(playerId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ tokenHash: tokenHash(token), playerId, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
  return token;
}
export const sessionCookieOptions = {
  httpOnly: true,
  secure: production,
  // Allow the game preview to retain a session inside an iframe without a
  // cross-site tracking cookie. Host binding + partitioning isolates it.
  sameSite: production ? "none" as const : "lax" as const,
  partitioned: production,
  path: "/",
  maxAge: SESSION_SECONDS,
};

export async function currentPlayer() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const rows = await db.select({
    id: players.id, name: players.name, gender: players.gender, face: players.face,
    email: players.email, sambisaHighscore: players.sambisaHighscore, createdAt: players.createdAt,
  }).from(sessions).innerJoin(players, eq(sessions.playerId, players.id))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return rows[0] ?? null;
}
export async function deleteCurrentSession() {
  const jar = await cookies();
  const tokens = [jar.get(SESSION_COOKIE)?.value, jar.get(LEGACY_COOKIE)?.value].filter((token): token is string => !!token && token.length <= 128);
  if (tokens.length) await db.delete(sessions).where(inArray(sessions.tokenHash, [...new Set(tokens.map(tokenHash))]));
}

/** Partitioned embedded sessions still only accept writes from the app origin. */
export function sameOriginRequest(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Non-browser clients must still authenticate normally.
  try {
    const actual = new URL(origin);
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host).split(",")[0].trim();
    return (actual.protocol === "https:" || actual.protocol === "http:") && actual.host === host;
  } catch { return false; }
}
