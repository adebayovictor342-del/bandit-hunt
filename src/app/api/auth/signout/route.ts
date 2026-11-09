import { NextResponse } from "next/server";
import { sameOriginRequest, deleteCurrentSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth.server";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  await deleteCurrentSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  if (SESSION_COOKIE !== "sambisa_session") res.cookies.set("sambisa_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
