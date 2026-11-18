import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { STORE_COOKIE, getStoreById } from "@/lib/store";

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { storeId?: string };
  if (!body.storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }
  const store = await getStoreById(body.storeId);
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = NextResponse.json({ ok: true, storeId: store.id, name: store.name });
  res.cookies.set(STORE_COOKIE, store.id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
