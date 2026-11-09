import { NextResponse } from "next/server";
import {
  adminCookieName,
  createAdminCookieValue,
  verifyAdminCookie,
  verifyAdminPassword,
} from "@/lib/admin.server";
import { sameOriginRequest } from "@/lib/auth.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json({
    configured: Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET),
    authenticated: verifyAdminCookie(readCookie(req, adminCookieName())),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: "Admin access is not configured on this deployment." }, { status: 503 });
  }
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Enter the admin password." }, { status: 400 });
  }
  if (!verifyAdminPassword(body.password)) {
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(adminCookieName(), createAdminCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}

export async function DELETE(req: Request) {
  if (!sameOriginRequest(req)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(adminCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function readCookie(req: Request, name: string) {
  const prefix = `${name}=`;
  const entry = (req.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry?.slice(prefix.length);
}
