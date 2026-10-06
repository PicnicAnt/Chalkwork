"use server";

import { validateDraft } from "@/lib/calculation";
import { canEdit, getCalculation, insertCalculation, updateCalculation as saveUpdate } from "@/lib/db";

export type SaveResult =
  | { ok: true; id: string; title: string; createdAt: string; editKey?: string }
  | { ok: false; errors: string[] };

export async function createCalculation(payload: unknown): Promise<SaveResult> {
  const { draft, errors } = validateDraft(payload);
  if (!draft) return { ok: false, errors };
  const { id, editKey } = insertCalculation(draft);
  const saved = getCalculation(id)!;
  return { ok: true, id, title: saved.title, createdAt: saved.createdAt, editKey };
}

// Only someone holding the edit key handed out at creation can change a calculation.
export async function updateCalculation(id: string, editKey: string, payload: unknown): Promise<SaveResult> {
  if (typeof id !== "string" || typeof editKey !== "string" || !canEdit(id, editKey)) {
    return { ok: false, errors: ["This browser doesn't have permission to edit this calculation."] };
  }
  const { draft, errors } = validateDraft(payload);
  if (!draft) return { ok: false, errors };
  saveUpdate(id, draft);
  const saved = getCalculation(id)!;
  return { ok: true, id, title: saved.title, createdAt: saved.createdAt };
}
