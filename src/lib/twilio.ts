import twilio from "twilio";

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set");
  }
  return twilio(sid, token);
}

export function validateTwilioRequest(
  signature: string | null,
  url: string,
  params: Record<string, string>,
) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return process.env.NODE_ENV === "development";
  return twilio.validateRequest(token, signature, url, params);
}

export function appBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}
