import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveAdminStore } from "@/lib/store";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const storeIdParam = url.searchParams.get("storeId");

  if (id) {
    const call = await prisma.call.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true } },
        utterances: { orderBy: { createdAt: "asc" } },
        escalations: { orderBy: { emailedAt: "desc" } },
      },
    });
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(call);
  }

  const include = {
    escalations: true,
    store: { select: { id: true, name: true } },
  } as const;

  if (storeIdParam === "all") {
    const calls = await prisma.call.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
      include,
    });
    return NextResponse.json(calls);
  }

  const store = await resolveAdminStore(storeIdParam);
  const calls = await prisma.call.findMany({
    where: { storeId: store.id },
    orderBy: { startedAt: "desc" },
    take: 100,
    include,
  });
  return NextResponse.json(calls);
}
