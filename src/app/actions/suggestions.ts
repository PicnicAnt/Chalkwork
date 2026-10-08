"use server";

import { getCurrentUser } from "@/lib/auth";
import { diffDrafts, draftOf } from "@/lib/change-suggestions";
import {
  boardStamp,
  countOpenSuggestionsByAuthorOnBoard,
  decideSuggestion,
  getCalculation,
  getSuggestion,
  insertSuggestion,
  updateCalculation as saveUpdate,
} from "@/lib/db";
import { prepare } from "./prepare";

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
