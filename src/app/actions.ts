"use server";

import { getCurrentUser } from "@/lib/auth";
import { parseIncludes, type Bundle } from "@/lib/boards";
import { validateDraft, type CalculationDraft } from "@/lib/calculation";
import { getCalculation, insertCalculation, updateCalculation as saveUpdate } from "@/lib/db";
import { resolveBoard, resolveIncludes } from "@/lib/resolve-boards";

export type SaveResult = { ok: true; id: string } | { ok: false; errors: string[] };

// Server actions can be called directly, not only from the page, so each one checks who is asking.

// Checks what the editor sent, together with the boards it uses, and says what to save.
function prepare(payload: unknown, selfId?: string): { draft: CalculationDraft } | { errors: string[] } {
  const { includes, errors: includeErrors } = parseIncludes((payload as { includes?: unknown } | null)?.includes);
  if (includeErrors.length) return { errors: includeErrors };
  const resolved = resolveIncludes(includes, selfId);
  if ("error" in resolved) return { errors: [resolved.error] };
  const { draft, errors } = validateDraft(payload, resolved.included);
  return draft ? { draft } : { errors };
}

export async function createCalculation(payload: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save a calculation."] };
  const prepared = prepare(payload);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  return { ok: true, id: insertCalculation(prepared.draft, user.id) };
}

// Only the owner can change a calculation.
export async function updateCalculation(id: string, payload: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save changes."] };
  if (typeof id !== "string" || getCalculation(id)?.ownerId !== user.id) {
    return { ok: false, errors: ["Only the owner can change this calculation."] };
  }
  const prepared = prepare(payload, id);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  if (!saveUpdate(id, user.id, prepared.draft)) {
    return { ok: false, errors: ["Only the owner can change this calculation."] };
  }
  return { ok: true, id };
}

export type BoardToUse = { ok: true; board: string; title: string; bundle: Bundle } | { ok: false; error: string };

// Loads a board so the editor can add it to the board being built. `selfId` is that board, if it
// already exists, so that boards can't end up using each other in a loop.
export async function loadBoardToUse(boardId: string, selfId?: string): Promise<BoardToUse> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sign in to use a board." };
  if (typeof boardId !== "string") return { ok: false, error: "Pick a board." };
  const found = resolveBoard(boardId, typeof selfId === "string" ? selfId : undefined);
  return "error" in found
    ? { ok: false, error: found.error }
    : { ok: true, board: boardId, title: found.title, bundle: found.bundle };
}

// Changes only the links of a board, which is what the Connections view edits. Everything else on
// the board is saved again as it is, through the same checks as a normal save.
export async function setBoardLinks(id: string, links: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save changes."] };
  const stored = typeof id === "string" ? getCalculation(id) : null;
  if (!stored || stored.ownerId !== user.id) return { ok: false, errors: ["Only the owner can change this board."] };
  if (typeof links !== "object" || links === null || Array.isArray(links)) return { ok: false, errors: ["Invalid links."] };
  const own: Record<string, unknown> = { ...stored, links };
  for (const key of ["id", "createdAt", "ownerId", "ownerName"]) delete own[key];
  const prepared = prepare(own, id);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  if (!saveUpdate(id, user.id, prepared.draft)) return { ok: false, errors: ["Only the owner can change this board."] };
  return { ok: true, id };
}
