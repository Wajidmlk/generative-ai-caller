import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/twilio";
import { findStoreByTwilioNumber, getOrCreateDefaultStore } from "@/lib/store";
import { normalizePhoneLookup } from "@/lib/phone";
import { synthesizeSpeech } from "@/lib/agent";
import { mkdir, writeFile } from "fs/promises";
import path from "path";


async function saveSpeechFile(callId: string, text: string, language: string, agentVoice: string) {
  const buf = await synthesizeSpeech(text, language, agentVoice);
  const dir = path.join(process.cwd(), "public", "audio");
  await mkdir(dir, { recursive: true });
  const filename = `${callId}-greeting.mp3`;
  await writeFile(path.join(dir, filename), buf);
  return `${appBaseUrl()}/audio/${filename}`;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const callSid = String(form.get("CallSid") || "");
  const from = String(form.get("From") || "");
  const to = String(form.get("To") || "");

  let store = await findStoreByTwilioNumber(to);
  if (!store) store = await getOrCreateDefaultStore();

  const fromNorm = normalizePhoneLookup(from) || from;
  const toNorm = normalizePhoneLookup(to) || to;

  let call = await prisma.call.findUnique({ where: { twilioSid: callSid } });
  if (!call) {
    call = await prisma.call.create({
      data: {
        storeId: store.id,
        twilioSid: callSid,
        fromNumber: fromNorm,
        toNumber: toNorm,
        status: "in_progress",
      },
    });
  }

  const lang = store.defaultLanguage === "ur" ? "ur" : "en";
  const greeting =
    lang === "ur"
      ? store.greetingUr || store.greetingEn || "السلام علیکم"
      : store.greetingEn || "Hello, how can I help you?";
  let playUrl: string | null = null;
  try {
    playUrl = await saveSpeechFile(call.id, greeting, lang, store.agentVoice || "alloy");
    await prisma.call.update({ where: { id: call.id }, data: { language: lang } });
  } catch (e) {
    console.error("[voice] TTS failed, falling back to Say:", e);
  }

  const vr = new twilio.twiml.VoiceResponse();
  if (playUrl) {
    vr.play(playUrl);
  } else {
    vr.say({ voice: "Polly.Joanna" }, greeting);
  }

  const gatherAction = `${appBaseUrl()}/api/twilio/gather?callId=${encodeURIComponent(call.id)}`;
  vr.record({
    action: gatherAction,
    method: "POST",
    maxLength: 20,
    playBeep: true,
    timeout: 4,
    trim: "trim-silence",
  });
  vr.say({ voice: "Polly.Joanna" }, "I did not hear anything. Goodbye.");

  return new NextResponse(vr.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
