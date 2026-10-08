import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSession, deleteSession, getSessionUser, hashToken, upsertUser } from "./db";

// How people are signed in, kept small and independent of the way they prove who they are:
//
//   1. A *provider* proves someone's identity and produces a SignInProfile. Today the only provider
//      is the test login in dev-login.ts (type a name, no password). Google sign-in would be a
//      second provider: its OAuth callback builds a profile from Google's id and name.
//   2. signInWithProfile() turns any profile into a user (created on first sight) and starts a
//      session with an httpOnly cookie. Everything else in the app only ever asks for the current
//      user, and never mentions providers.
//
// Replacing the test login therefore means adding a provider that calls signInWithProfile() and
// turning the test login off; nothing that uses getCurrentUser() has to change.

export type User = { id: string; name: string; provider: string };

/** What a provider hands over after it has checked who someone is. */
export type SignInProfile = {
  /** Which provider vouches for this person, such as "dev" or "google". */
  provider: string;
  /** The provider's own stable id for them (Google's `sub`, for example). */
  accountId: string;
  /** A name to show; used when the user is first created. */
  name: string;
};

const COOKIE = "chalkwork_session";
const SESSION_DAYS = 30;

// The signed-in user for this request, or null. Cached per request so a page, its layout and its
// actions can all ask without repeating the lookup.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? getSessionUser(hashToken(token)) : null;
});

// For pages that need someone signed in: sends everyone else to the login page and back again.
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

// Call from a server action or route handler, because it sets a cookie.
export async function signInWithProfile(profile: SignInProfile): Promise<User> {
  const user = upsertUser(profile);
  const token = randomBytes(32).toString("base64url");
  createSession(hashToken(token), user.id, new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    // The app is served over plain http on the home network for now, where a secure cookie would
    // never be sent. Set COOKIE_SECURE=1 once it runs on https (Google sign-in needs that anyway).
    secure: process.env.COOKIE_SECURE === "1",
  });
  return user;
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) deleteSession(hashToken(token));
  store.delete(COOKIE);
}

// Only follow redirects to pages of this app, never to another site.
export function safeReturnPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/";
}
