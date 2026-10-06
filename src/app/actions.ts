"use server";

import { validateDraft } from "@/lib/calculation";
import { getCalculation, insertCalculation } from "@/lib/db";

export type CreateResult = { ok: true; id: string; title: string; createdAt: string } | { ok: false; errors: string[] };

export async function createCalculation(payload: unknown): Promise<CreateResult> {
  const { draft, errors } = validateDraft(payload);
  if (!draft) return { ok: false, errors };
  const id = insertCalculation(draft);
  const saved = getCalculation(id)!;
  return { ok: true, id, title: saved.title, createdAt: saved.createdAt };
}
