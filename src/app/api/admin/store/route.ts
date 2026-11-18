import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveAdminStore } from "@/lib/store";
import { formatPhoneE164 } from "@/lib/phone";
import { resolveAgentVoice } from "@/lib/voices";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  const store = await resolveAdminStore(id);
  return NextResponse.json(store);
}

export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const store = await resolveAdminStore(body.id);
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lang =
    body.defaultLanguage === "ur" ? "ur" : body.defaultLanguage === "en" ? "en" : store.defaultLanguage;

  let twilioNumber = "";
  try {
    twilioNumber = formatPhoneE164(String(body.twilioNumber ?? store.twilioNumber ?? ""));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid Twilio number" },
      { status: 400 },
    );
  }

  if (twilioNumber) {
    const clash = await prisma.store.findFirst({
      where: { twilioNumber, NOT: { id: store.id } },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Twilio number already used by store "${clash.name}"` },
        { status: 409 },
      );
    }
  }

  await prisma.store.update({
    where: { id: store.id },
    data: {
      name: body.name ?? store.name,
      description: body.description ?? store.description,
      address: body.address ?? store.address,
      hours: body.hours ?? store.hours,
      contactEmail: body.contactEmail ?? store.contactEmail,
      contactName: body.contactName ?? store.contactName,
      twilioNumber,
      defaultLanguage: lang,
      agentVoice: resolveAgentVoice(body.agentVoice ?? store.agentVoice),
      greetingEn: body.greetingEn ?? store.greetingEn,
      greetingUr: body.greetingUr ?? store.greetingUr,
    },
  });

  if (Array.isArray(body.policies)) {
    for (const p of body.policies) {
      if (!p.id) continue;
      await prisma.callPolicy.update({
        where: { id: p.id },
        data: {
          enabled: Boolean(p.enabled),
          shareInfo: Boolean(p.shareInfo),
          notifyContact: Boolean(p.notifyContact),
          notes: p.notes ?? "",
        },
      });
    }
  }

  const fresh = await prisma.store.findUnique({
    where: { id: store.id },
    include: { products: true, policies: true },
  });
  return NextResponse.json(fresh);
}
