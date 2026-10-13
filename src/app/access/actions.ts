"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessProof, checkAccessCode } from "@/lib/access-guard";
import { safeReturnPath } from "@/lib/auth";

export type AccessState = { error?: string };

// Checks the code and, if it is right, remembers this device for a year.
export async function enterAccessCode(_previous: AccessState, formData: FormData): Promise<AccessState> {
  const result = checkAccessCode(formData.get("code"));
  if (!result.ok) return { error: result.error };
  (await cookies()).set(ACCESS_COOKIE, accessProof(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    secure: process.env.COOKIE_SECURE === "1",
  });
  redirect(safeReturnPath(formData.get("next")));
}
