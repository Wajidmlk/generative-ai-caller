import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveAdminStore } from "@/lib/store";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("storeId");
  const store = await resolveAdminStore(id);
  return NextResponse.json({
    storeId: store.id,
    storeName: store.name,
    products: store.products,
  });
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const store = await resolveAdminStore(body.storeId);
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const products = Array.isArray(body.products) ? body.products : [];

  for (const p of products) {
    if (p._delete && p.id) {
      const owned = await prisma.product.findFirst({ where: { id: p.id, storeId: store.id } });
      if (owned) await prisma.product.delete({ where: { id: p.id } });
      continue;
    }
    if (p.id) {
      const owned = await prisma.product.findFirst({ where: { id: p.id, storeId: store.id } });
      if (!owned) continue;
      await prisma.product.update({
        where: { id: p.id },
        data: {
          name: p.name,
          summary: p.summary ?? "",
          description: p.description ?? "",
          price: p.price ?? "",
          quality: p.quality ?? "standard",
          available: Boolean(p.available),
        },
      });
    } else if (p.name) {
      await prisma.product.create({
        data: {
          storeId: store.id,
          name: p.name,
          summary: p.summary ?? "",
          description: p.description ?? "",
          price: p.price ?? "",
          quality: p.quality ?? "standard",
          available: p.available !== false,
        },
      });
    }
  }

  const fresh = await prisma.product.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ storeId: store.id, storeName: store.name, products: fresh });
}
