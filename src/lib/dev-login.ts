import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SignInProfile } from "./auth";

// The test login: anyone can sign in as any name, with no password. It exists so the app can be
// tried with several users on a home network, and it is NOT safe on the internet. It is on unless
// CHALKWORK_DEV_LOGIN is set to 0. When a real provider (Google) is added, turn this off.
export function devLoginEnabled(): boolean {
  return process.env.CHALKWORK_DEV_LOGIN !== "0";
}

// When CHALKWORK_ACCESS_CODE is set, the test login also asks for that code. This is what makes it
// reasonable to reach the site from the internet (through a tunnel): only people who were given the
// code can sign in. It is one shared code, not a password per user.
export const accessCodeRequired = (): boolean => !!process.env.CHALKWORK_ACCESS_CODE;

const digest = (text: string) => createHash("sha256").update(text).digest();

// Wrong guesses are counted for ten minutes; after ten of them no code is accepted until they expire.
const MISSES: number[] = [];
const WINDOW_MS = 10 * 60 * 1000;
const MAX_MISSES = 10;

export function checkAccessCode(raw: unknown): { ok: true } | { ok: false; error: string } {
  const code = process.env.CHALKWORK_ACCESS_CODE;
  if (!code) return { ok: true };
  const now = Date.now();
  while (MISSES.length && now - MISSES[0] > WINDOW_MS) MISSES.shift();
  if (MISSES.length >= MAX_MISSES) return { ok: false, error: "Too many wrong codes. Try again in a few minutes." };
  if (typeof raw === "string" && timingSafeEqual(digest(raw.trim()), digest(code))) return { ok: true };
  MISSES.push(now);
  return { ok: false, error: "That access code is not right." };
}

// Once the code is right, the device is remembered with a cookie that holds a keyed hash of the
// code, never the code itself. It stays valid for a year, and changing the code invalidates it.
const ACCESS_COOKIE = "chalkwork_access";
const proofOf = () => createHmac("sha256", process.env.CHALKWORK_ACCESS_CODE ?? "").update("chalkwork-access-v1").digest("hex");

export async function hasAccess(): Promise<boolean> {
  if (!accessCodeRequired()) return true;
  const have = (await cookies()).get(ACCESS_COOKIE)?.value;
  return typeof have === "string" && timingSafeEqual(digest(have), digest(proofOf()));
}

// Checks the code and, if it is right, remembers this device.
export async function grantAccess(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = checkAccessCode(raw);
  if (!result.ok) return result;
  (await cookies()).set(ACCESS_COOKIE, proofOf(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    secure: process.env.COOKIE_SECURE === "1",
  });
  return { ok: true };
}

export const DEV_PROVIDER = "dev";

const NAME = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,29}$/;

// Turns what was typed into a profile, or says why it can't be used.
export function profileFromDevName(raw: unknown): { profile?: SignInProfile; error?: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!NAME.test(name)) {
    return { error: "Use 2 to 30 letters, digits, spaces, dots, dashes or underscores." };
  }
  // "Martin" and "martin" are the same person.
  return { profile: { provider: DEV_PROVIDER, accountId: name.toLowerCase(), name } };
}
