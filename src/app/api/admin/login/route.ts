import { NextResponse } from "next/server";
import { adminCookieName, checkAdminPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { password?: string };
  if (!checkAdminPassword(body.password || "")) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
