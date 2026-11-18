import { cookies } from "next/headers";

const COOKIE = "gai_admin";

export async function isAdminAuthed() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === "1";
}

export function adminCookieName() {
  return COOKIE;
}

export function checkAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD || "changeme";
  return password === expected;
}
