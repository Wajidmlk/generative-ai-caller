import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const form = await req.formData();
  const callSid = String(form.get("CallSid") || "");
  const status = String(form.get("CallStatus") || "");

  if (callSid && ["completed", "busy", "failed", "no-answer"].includes(status)) {
    const call = await prisma.call.findUnique({ where: { twilioSid: callSid } });
    if (call && call.status === "in_progress") {
      await prisma.call.update({
        where: { id: call.id },
        data: { status: "completed", endedAt: new Date() },
      });
    } else if (call && !call.endedAt) {
      await prisma.call.update({
        where: { id: call.id },
        data: { endedAt: new Date() },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
