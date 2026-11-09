import { NextResponse } from "next/server";
import { sameOriginRequest } from "@/lib/auth.server";
import { newPresenceId, recordOnlineVisitor } from "@/lib/admin.server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const production = process.env.NODE_ENV === "production";
  const cookieName = production ? "__Host-sambisa_presence" : "sambisa_presence";
  const existing = readCookie(req, cookieName);
  const id = existing && /^[A-Za-z0-9_-]{40,50}$/.test(existing) ? existing : newPresenceId();
  await recordOnlineVisitor(id);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (id !== existing) {
    response.cookies.set(cookieName, id, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}

function readCookie(req: Request, name: string) {
  const prefix = `${name}=`;
  const entry = (req.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry?.slice(prefix.length);
}
