"use server";

import { getCurrentUser } from "@/lib/auth";
import { parseIncludes, type Bundle } from "@/lib/boards";
import { validateDraft, type CalculationDraft } from "@/lib/calculation";
import {
  boardStamp,
  boardsUsing,
  countOpenSuggestionsByAuthorOnBoard,
  decideSuggestion,
  deleteCalculation,
  getCalculation,
  getSuggestion,
  insertCalculation,
  insertSuggestion,
  updateCalculation as saveUpdate,
} from "@/lib/db";
import { diffDrafts, draftOf } from "@/lib/change-suggestions";
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

export type DeleteResult = { ok: true } | { ok: false; error: string };

// Deletes a board for good. A board that other boards use is kept, since they would break.
export async function deleteBoard(id: string): Promise<DeleteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to delete a board." };
  const stored = typeof id === "string" ? getCalculation(id) : null;
  if (!stored || stored.ownerId !== user.id) return { ok: false, error: "Only the owner can delete this board." };
  const users = boardsUsing(id);
  if (users.length > 0) {
    const names = users.slice(0, 5).map((b) => `"${b.title}"`).join(", ");
    return {
      ok: false,
      error: `Other boards use this one: ${names}${users.length > 5 ? ` and ${users.length - 5} more` : ""}. Stop using it there first.`,
    };
  }
  if (!deleteCalculation(id, user.id)) return { ok: false, error: "Only the owner can delete this board." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Suggested changes: someone else's version of a board, which its owner approves or rejects.

export type SuggestionResult = { ok: true; id: string } | { ok: false; errors: string[] };
export type DecisionResult = { ok: true } | { ok: false; error: string; changedSince?: boolean };

const MAX_OPEN_PER_BOARD = 5;
const MAX_TEXT = 500;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");

// Sends a suggestion for someone else's board. It is checked like a normal save, so only a board
// that could really be saved is suggested.
export async function createSuggestion(boardId: string, payload: unknown, message: unknown): Promise<SuggestionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to suggest a change."] };
  const board = typeof boardId === "string" ? getCalculation(boardId) : null;
  if (!board) return { ok: false, errors: ["That board doesn't exist."] };
  if (board.ownerId === user.id) return { ok: false, errors: ["This is your own board: change it directly."] };
  if (board.ownerId === null) return { ok: false, errors: ["This board has no owner to approve a change."] };
  if (countOpenSuggestionsByAuthorOnBoard(user.id, boardId) >= MAX_OPEN_PER_BOARD) {
    return { ok: false, errors: [`You already have ${MAX_OPEN_PER_BOARD} open suggestions on this board. Wait for an answer or withdraw one.`] };
  }
  const prepared = prepare(payload, boardId);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  if (diffDrafts(draftOf(board), prepared.draft).length === 0) return { ok: false, errors: ["Nothing is different from the board."] };
  const stamp = boardStamp(boardId);
  if (!stamp) return { ok: false, errors: ["That board doesn't exist."] };
  const id = insertSuggestion({ boardId, authorId: user.id, message: clean(message), draft: prepared.draft, baseStamp: stamp });
  return { ok: true, id };
}

// The owner takes the suggestion: the board becomes the suggested version. If the board was changed
// after the suggestion was made, that has to be confirmed, since those changes are replaced.
export async function approveSuggestion(id: string, force = false): Promise<DecisionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const s = typeof id === "string" ? getSuggestion(id) : null;
  if (!s || s.boardOwnerId !== user.id) return { ok: false, error: "Only the owner of the board can approve this." };
  if (s.status !== "open") return { ok: false, error: "This suggestion has already been answered." };
  if (!force && boardStamp(s.boardId) !== s.baseStamp) {
    return { ok: false, error: "The board has changed since this was suggested. Approving replaces those changes.", changedSince: true };
  }
  const prepared = prepare(s.draft, s.boardId);
  if ("errors" in prepared) return { ok: false, error: `It no longer fits the board: ${prepared.errors.join(" ")}` };
  if (!saveUpdate(s.boardId, user.id, prepared.draft)) return { ok: false, error: "Only the owner of the board can approve this." };
  decideSuggestion(id, "approved", "");
  return { ok: true };
}

export async function rejectSuggestion(id: string, note: unknown): Promise<DecisionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const s = typeof id === "string" ? getSuggestion(id) : null;
  if (!s || s.boardOwnerId !== user.id) return { ok: false, error: "Only the owner of the board can reject this." };
  if (!decideSuggestion(id, "rejected", clean(note))) return { ok: false, error: "This suggestion has already been answered." };
  return { ok: true };
}

export async function withdrawSuggestion(id: string): Promise<DecisionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const s = typeof id === "string" ? getSuggestion(id) : null;
  if (!s || s.authorId !== user.id) return { ok: false, error: "Only the person who suggested this can withdraw it." };
  if (!decideSuggestion(id, "withdrawn", "")) return { ok: false, error: "This suggestion has already been answered." };
  return { ok: true };
}
