import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { synthesizeSpeech } from "@/lib/agent";
import { resolveAgentVoice } from "@/lib/voices";

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    voice?: string;
    language?: string;
  };

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const buf = await synthesizeSpeech(
      text,
      body.language === "ur" ? "ur" : "en",
      resolveAgentVoice(body.voice),
    );
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[voice-demo]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TTS failed" },
      { status: 500 },
    );
  }
}
