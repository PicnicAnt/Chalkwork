"use server";

import { redirect } from "next/navigation";
import { safeReturnPath, signInWithProfile, signOut } from "@/lib/auth";
import { devLoginEnabled, grantAccess, hasAccess, profileFromDevName } from "@/lib/dev-login";

export type LoginState = { error?: string };

// The test login. Another provider (Google) would get its own route that ends in the same call to
// signInWithProfile().
export async function devSignIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!devLoginEnabled()) return { error: "The test login is turned off." };
  if (!(await hasAccess())) return { error: "Enter the access code first." };
  const { profile, error } = profileFromDevName(formData.get("name"));
  if (!profile) return { error };
  await signInWithProfile(profile);
  redirect(safeReturnPath(formData.get("next")));
}

// The access code, asked once per device. The users are listed after it has been given.
export async function enterAccessCode(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!devLoginEnabled()) return { error: "The test login is turned off." };
  const result = await grantAccess(formData.get("code"));
  if (!result.ok) return { error: result.error };
  redirect(`/login?next=${encodeURIComponent(safeReturnPath(formData.get("next")))}`);
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}
