import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";
import { sameOriginRequest, createSession, normaliseEmail, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from "@/lib/auth.server";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  const data = await req.json().catch(() => ({}));
  const email = normaliseEmail(data.email);
  const password = typeof data.password === "string" ? data.password : "";
  if (!email || !password || password.length > 128) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const [p] = await db.select().from(players).where(eq(players.email, email)).limit(1);
  if (!p?.passwordHash || !(await verifyPassword(password, p.passwordHash))) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const token = await createSession(p.id);
  const res = NextResponse.json({ player: { id: p.id, name: p.name, email: p.email, gender: p.gender, face: p.face } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
