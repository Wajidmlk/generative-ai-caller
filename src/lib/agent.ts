import { getOpenAI } from "./openai";
import { prisma } from "./db";
import { sendContactEmail } from "./mail";

export type AgentResult = {
  reply: string;
  language: string;
  escalate?: { type: "order" | "human"; summary: string };
};

type StoreContext = {
  id: string;
  name: string;
  description: string;
  address: string;
  hours: string;
  contactEmail: string;
  contactName: string;
  products: { name: string; summary: string; description: string; price: string; quality: string; available: boolean }[];
  defaultLanguage: string;
  policies: { intent: string; enabled: boolean; shareInfo: boolean; notifyContact: boolean; notes: string }[];
};

async function loadStoreContext(storeId: string): Promise<StoreContext | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { products: true, policies: true },
  });
  if (!store) return null;
  return {
    id: store.id,
    name: store.name,
    description: store.description,
    address: store.address,
    hours: store.hours,
    contactEmail: store.contactEmail,
    contactName: store.contactName,
    defaultLanguage: store.defaultLanguage || "en",
    products: store.products.map((p) => ({
      name: p.name,
      summary: p.summary,
      description: p.description,
      price: p.price,
      quality: p.quality || "standard",
      available: p.available,
    })),
    policies: store.policies.map((p) => ({
      intent: p.intent,
      enabled: p.enabled,
      shareInfo: p.shareInfo,
      notifyContact: p.notifyContact,
      notes: p.notes,
    })),
  };
}

function policyAllows(ctx: StoreContext, intent: string) {
  const p = ctx.policies.find((x) => x.intent === intent);
  if (!p) return { enabled: true, shareInfo: true, notifyContact: intent === "order" || intent === "human" };
  return p;
}

export async function handleCallerTurn(opts: {
  storeId: string;
  callId: string;
  callerText: string;
  history: { role: "caller" | "ai"; text: string }[];
}): Promise<AgentResult> {
  const ctx = await loadStoreContext(opts.storeId);
  if (!ctx) {
    return { reply: "Sorry, this store is not configured yet.", language: "en" };
  }

  const openai = getOpenAI();

  const system = `You are a phone receptionist for "${ctx.name}".
Default store language is ${ctx.defaultLanguage === "ur" ? "Urdu" : "English"}.
Reply in the SAME language the caller used (Urdu or English). Prefer short product summaries first, then details if asked.
Keep replies short for speech (1-3 sentences).
Store facts:
- Description: ${ctx.description || "n/a"}
- Address: ${ctx.address || "n/a"}
- Hours: ${ctx.hours || "n/a"}
- Products (JSON): ${JSON.stringify(ctx.products)}
- Policies (JSON): ${JSON.stringify(ctx.policies)}

Rules:
- Only share product/store info if the matching policy has shareInfo=true (or no policy).
- If caller wants to place an order OR talk to a human, and policy allows notify:
  set escalate.type to "order" or "human", write a short escalate.summary, and tell the caller
  that the store contact will call them back as soon as possible. Do NOT invent that a human is on the line now.
- Never invent prices or availability not in the product list.
- Respond ONLY with JSON: {"reply":"...","language":"en"|"ur","escalate":null|{"type":"order"|"human","summary":"..."}}`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...opts.history.slice(-8).map((u) => ({
      role: (u.role === "caller" ? "user" : "assistant") as "user" | "assistant",
      content: u.text,
    })),
    { role: "user", content: opts.callerText },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages,
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: AgentResult = { reply: "Sorry, I did not understand. Please say that again.", language: "en" };
  try {
    const j = JSON.parse(raw) as {
      reply?: string;
      language?: string;
      escalate?: { type?: string; summary?: string } | null;
    };
    parsed = {
      reply: j.reply || parsed.reply,
      language: j.language === "ur" ? "ur" : "en",
      escalate:
        j.escalate?.type === "order" || j.escalate?.type === "human"
          ? { type: j.escalate.type, summary: j.escalate.summary || j.reply || "" }
          : undefined,
    };
  } catch {
    parsed.reply = raw.slice(0, 400) || parsed.reply;
  }

  if (parsed.escalate) {
    const intent = parsed.escalate.type;
    const pol = policyAllows(ctx, intent);
    if (!pol.enabled || !pol.notifyContact) {
      parsed.escalate = undefined;
      if (!pol.enabled) {
        parsed.reply =
          parsed.language === "ur"
            ? "معذرت، اس درخواست پر ابھی مدد دستیاب نہیں۔"
            : "Sorry, we cannot help with that request right now.";
      }
    } else {
      const mail = await sendContactEmail({
        to: ctx.contactEmail,
        subject: `[AI Caller] ${intent.toUpperCase()} - ${ctx.name}`,
        text: [
          `Store: ${ctx.name}`,
          `Type: ${intent}`,
          `Caller Call ID: ${opts.callId}`,
          `Summary: ${parsed.escalate.summary}`,
          `Last caller message: ${opts.callerText}`,
          "",
          "Please call the customer back ASAP.",
        ].join("\n"),
      });

      await prisma.escalation.create({
        data: {
          callId: opts.callId,
          type: intent,
          summary: parsed.escalate.summary,
          emailedTo: ctx.contactEmail || "",
          success: mail.ok,
          error: mail.ok ? "" : mail.error,
        },
      });

      await prisma.call.update({
        where: { id: opts.callId },
        data: { status: "escalated", summary: parsed.escalate.summary, language: parsed.language },
      });
    }
  }

  return parsed;
}

export async function transcribeAudio(buffer: Buffer, filename = "audio.wav") {
  const openai = getOpenAI();
  const { toFile } = await import("openai");
  const file = await toFile(buffer, filename, { type: "audio/wav" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return result.text;
}

export async function synthesizeSpeech(
  text: string,
  _language: string,
  voice = "alloy",
) {
  const openai = getOpenAI();
  const { resolveAgentVoice } = await import("./voices");
  const speech = await openai.audio.speech.create({
    model: "tts-1",
    voice: resolveAgentVoice(voice),
    input: text.slice(0, 900),
    response_format: "mp3",
  });
  const ab = await speech.arrayBuffer();
  return Buffer.from(ab);
}
