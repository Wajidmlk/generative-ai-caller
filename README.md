# Generative AI Caller (v1 test)

Low-cost AI phone receptionist for a store: Twilio Voice + Whisper + GPT-4o-mini + TTS, with email escalation.

## What you need to buy / create

| Service | Why | Approx cost for testing |
|---------|-----|-------------------------|
| **Twilio** account + 1 phone number | Receive calls | ~$1.15/mo number + per-minute voice |
| **OpenAI** API key | Whisper STT, gpt-4o-mini replies, tts-1 speech | Pay-as-you-go (mini models stay cheap) |
| **SMTP email** (Gmail app password or similar) | Email contact on order/human requests | Free |
| **Public HTTPS URL** | Twilio webhooks (ngrok locally, or any host) | ngrok free tier OK |

No paid auth, no Realtime API, no SMS - keeps v1 cheap.

## Pages

- `/` - public product page
- `/admin/login` - password from `ADMIN_PASSWORD`
- `/admin/setup` - store, products, contact email, call policies
- `/admin/calls` - call list + transcripts

## Call flow (cheap turn-based)

1. Inbound Twilio webhook → `/api/twilio/voice`
2. Play greeting (OpenAI TTS) → Record caller
3. `/api/twilio/gather` downloads recording → Whisper → GPT-4o-mini (store/products/policies) → TTS reply
4. Loop until hangup, or escalate (order/human) → email contact → hang up

## Setup

```bash
cp .env.example .env
# fill OPENAI_API_KEY, TWILIO_*, SMTP_*, ADMIN_PASSWORD, APP_BASE_URL

npm install
npx prisma db push
npm run dev
```

Expose locally:

```bash
ngrok http 3000
# set APP_BASE_URL to the ngrok https URL
```

### Twilio console

On your Twilio number:

- **A call comes in** → Webhook `POST` `{APP_BASE_URL}/api/twilio/voice`
- Status callback (optional) → `{APP_BASE_URL}/api/twilio/status`

Then open `/admin/setup`, set **contact email** + **Twilio number**, save products/policies.

## Env reference

See `.env.example`.
