import { NextResponse } from "next/server";
import twilio from "twilio";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/twilio";
import { handleCallerTurn, synthesizeSpeech, transcribeAudio } from "@/lib/agent";
import { mkdir, writeFile } from "fs/promises";
import path from "path";


async function downloadRecording(url: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const auth =
    sid && token ? "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") : undefined;
  const audioUrl = url.includes(".wav") || url.includes(".mp3") ? url : `${url}.wav`;
  const res = await fetch(audioUrl, {
    headers: auth ? { Authorization: auth } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to download recording: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function saveReplyAudio(callId: string, turn: number, text: string, language: string) {
  const buf = await synthesizeSpeech(text, language);
  const dir = path.join(process.cwd(), "public", "audio");
  await mkdir(dir, { recursive: true });
  const filename = `${callId}-${turn}.mp3`;
  await writeFile(path.join(dir, filename), buf);
  return `${appBaseUrl()}/audio/${filename}`;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const callId = url.searchParams.get("callId") || "";
  const form = await req.formData();
  const recordingUrl = String(form.get("RecordingUrl") || "");
  const digits = String(form.get("Digits") || "");

  const vr = new twilio.twiml.VoiceResponse();

  const call = callId
    ? await prisma.call.findUnique({
        where: { id: callId },
        include: { utterances: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  if (!call) {
    vr.say("Sorry, call session was lost. Goodbye.");
    return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  let callerText = "";
  try {
    if (recordingUrl) {
      const audio = await downloadRecording(recordingUrl);
      callerText = (await transcribeAudio(audio, "caller.wav")).trim();
    } else if (digits) {
      callerText = `Pressed ${digits}`;
    }
  } catch (e) {
    console.error("[gather] transcribe failed:", e);
  }

  if (!callerText) {
    vr.say("I could not understand. Please try again after the beep.");
    vr.record({
      action: `${appBaseUrl()}/api/twilio/gather?callId=${encodeURIComponent(call.id)}`,
      method: "POST",
      maxLength: 20,
      playBeep: true,
      timeout: 4,
      trim: "trim-silence",
    });
    return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  await prisma.utterance.create({
    data: { callId: call.id, role: "caller", text: callerText },
  });

  const history = call.utterances.map((u) => ({
    role: u.role as "caller" | "ai",
    text: u.text,
  }));

  let result;
  try {
    result = await handleCallerTurn({
      storeId: call.storeId,
      callId: call.id,
      callerText,
      history,
    });
  } catch (e) {
    console.error("[gather] agent failed:", e);
    result = {
      reply: "Sorry, I am having trouble right now. Please call again later.",
      language: "en",
    };
  }

  await prisma.utterance.create({
    data: { callId: call.id, role: "ai", text: result.reply },
  });
  await prisma.call.update({
    where: { id: call.id },
    data: { language: result.language },
  });

  const turn = call.utterances.length + 2;
  try {
    const playUrl = await saveReplyAudio(call.id, turn, result.reply, result.language);
    vr.play(playUrl);
  } catch (e) {
    console.error("[gather] TTS failed:", e);
    vr.say({ voice: "Polly.Joanna" }, result.reply);
  }

  if (result.escalate) {
    vr.pause({ length: 1 });
    vr.say({ voice: "Polly.Joanna" }, "Goodbye.");
    vr.hangup();
  } else {
    vr.record({
      action: `${appBaseUrl()}/api/twilio/gather?callId=${encodeURIComponent(call.id)}`,
      method: "POST",
      maxLength: 20,
      playBeep: true,
      timeout: 4,
      trim: "trim-silence",
    });
  }

  return new NextResponse(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}
