import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { createStore, listStores, getOrCreateDefaultStore } from "@/lib/store";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await getOrCreateDefaultStore();
  const stores = await listStores();
  return NextResponse.json(stores);
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const store = await createStore(body.name?.trim() || "New Store");
  return NextResponse.json(store);
}
