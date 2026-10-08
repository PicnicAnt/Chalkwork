import "server-only";
import type { SignInProfile } from "./auth";

// The test login: anyone can sign in as any name, with no password. It exists so the app can be
// tried with several users on a home network, and it is NOT safe on the internet. It is on unless
// CHALKWORK_DEV_LOGIN is set to 0. When a real provider (Google) is added, turn this off.
export function devLoginEnabled(): boolean {
  return process.env.CHALKWORK_DEV_LOGIN !== "0";
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
