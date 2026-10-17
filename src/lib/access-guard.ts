import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// The site-wide access code. When CHALKWORK_ACCESS_CODE is set, nobody gets past the front door of the site
// without it: not to read a board, not to sign in. It is one shared code, which is what makes it reasonable to
// reach the site from the internet through a tunnel while it is being tried. It is separate from signing in.
export const ACCESS_COOKIE = "chalkwork_access";

export const accessCodeRequired = (): boolean => !!process.env.CHALKWORK_ACCESS_CODE;

// The code is only asked for on the way in from the internet. Cloudflare puts these headers on everything its tunnel
// carries; a request on the home network doesn't have them. (Someone adding them by hand only gets asked for the code.)
export const viaTunnel = (headers: Headers): boolean => headers.has("cf-ray") || headers.has("cf-connecting-ip");

const digest = (text: string) => createHash("sha256").update(text).digest();

// What a device holds once the code was right: a keyed hash of the code, never the code itself. Changing the code
// makes every held proof stop working.
export const accessProof = (): string =>
  createHmac("sha256", process.env.CHALKWORK_ACCESS_CODE ?? "").update("chalkwork-access-v1").digest("hex");

export function isProofValid(value: string | undefined): boolean {
  if (!accessCodeRequired()) return true;
  return typeof value === "string" && timingSafeEqual(digest(value), digest(accessProof()));
}

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
