import { NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";
import { sameOriginRequest, cleanName, createSession, hashPassword, newPlayerId, normaliseEmail, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth.server";

export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  const data = await req.json().catch(() => ({}));
  const name = cleanName(data.name);
  const email = normaliseEmail(data.email);
  const password = typeof data.password === "string" ? data.password : "";
  const gender = data.gender === "female" ? "female" : "male";
  if (name.length < 2) return NextResponse.json({ error: "Choose a callsign with at least 2 characters." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 8 || password.length > 128) return NextResponse.json({ error: "Password must be 8–128 characters." }, { status: 400 });
  try {
    const id = newPlayerId();
    const face = gender === "female" ? "👩‍🚀" : "👨‍🚀";
    await db.insert(players).values({ id, name, email, passwordHash: await hashPassword(password), gender, face });
    const token = await createSession(id);
    const res = NextResponse.json({ player: { id, name, email, gender, face } }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error) {
    if (String(error).includes("players_email_unique") || (error as { cause?: { code?: string } }).cause?.code === "23505")
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    console.error("signup failed", error);
    return NextResponse.json({ error: "Could not create your account. Try again." }, { status: 500 });
  }
}
