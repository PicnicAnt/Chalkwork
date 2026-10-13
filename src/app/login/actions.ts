"use server";

import { redirect } from "next/navigation";
import { safeReturnPath, signInWithProfile, signOut } from "@/lib/auth";
import { devLoginEnabled, profileFromDevName } from "@/lib/dev-login";

export type LoginState = { error?: string };

// The test login. Another provider (Google) would get its own route that ends in the same call to
// signInWithProfile().
export async function devSignIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!devLoginEnabled()) return { error: "The test login is turned off." };
  const { profile, error } = profileFromDevName(formData.get("name"));
  if (!profile) return { error };
  await signInWithProfile(profile);
  redirect(safeReturnPath(formData.get("next")));
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}
