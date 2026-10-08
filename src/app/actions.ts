"use server";

import { getCurrentUser } from "@/lib/auth";
import { validateDraft } from "@/lib/calculation";
import { getCalculation, insertCalculation, updateCalculation as saveUpdate } from "@/lib/db";

export type SaveResult = { ok: true; id: string } | { ok: false; errors: string[] };

// Server actions can be called directly, not only from the page, so each one checks who is asking.

export async function createCalculation(payload: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save a calculation."] };
  const { draft, errors } = validateDraft(payload);
  if (!draft) return { ok: false, errors };
  return { ok: true, id: insertCalculation(draft, user.id) };
}

// Only the owner can change a calculation.
export async function updateCalculation(id: string, payload: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save changes."] };
  if (typeof id !== "string" || getCalculation(id)?.ownerId !== user.id) {
    return { ok: false, errors: ["Only the owner can change this calculation."] };
  }
  const { draft, errors } = validateDraft(payload);
  if (!draft) return { ok: false, errors };
  if (!saveUpdate(id, user.id, draft)) return { ok: false, errors: ["Only the owner can change this calculation."] };
  return { ok: true, id };
}
