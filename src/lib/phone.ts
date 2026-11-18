import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

function defaultCountry(): CountryCode {
  const raw = (process.env.APP_PHONE_DEFAULT_COUNTRY || "US").toUpperCase();
  return raw as CountryCode;
}

/** Normalize user/Twilio input to E.164 (+XXXXXXXX). Returns "" if empty. Throws if invalid. */
export function formatPhoneE164(input: string, country?: CountryCode): string {
  const raw = String(input || "").trim();
  if (!raw) return "";

  const parsed =
    parsePhoneNumberFromString(raw, country || defaultCountry()) ||
    parsePhoneNumberFromString(raw);

  if (!parsed || !parsed.isValid()) {
    throw new Error(
      `Invalid phone number "${raw}". Use international format, e.g. +14155552671`,
    );
  }
  return parsed.format("E.164");
}

/** Best-effort normalize for lookups (never throws). */
export function normalizePhoneLookup(input: string, country?: CountryCode): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    return formatPhoneE164(raw, country);
  } catch {
    // Fallback: keep digits and leading +
    const digits = raw.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) return digits;
    if (digits) return `+${digits}`;
    return raw;
  }
}
