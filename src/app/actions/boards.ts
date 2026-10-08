"use server";

import { getCurrentUser } from "@/lib/auth";
import type { Bundle } from "@/lib/boards";
import { boardsUsing, removeBoard, getBoard, insertBoard, saveBoard } from "@/lib/db";
import { resolveBoard } from "@/lib/resolve-boards";
import { prepare } from "./prepare";

// What a board's owner (and anyone signed in) does with boards. Every action checks who is asking.

export type SaveResult = { ok: true; id: string } | { ok: false; errors: string[] };

export async function createBoard(payload: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save a board."] };
  const prepared = prepare(payload);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  return { ok: true, id: insertBoard(prepared.draft, user.id) };
}

// Only the owner can change a calculation.
export async function updateBoard(id: string, payload: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, errors: ["Sign in to save changes."] };
  if (typeof id !== "string" || getBoard(id)?.ownerId !== user.id) {
    return { ok: false, errors: ["Only the owner can change this board."] };
  }
  const prepared = prepare(payload, id);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  if (!saveBoard(id, user.id, prepared.draft)) {
    return { ok: false, errors: ["Only the owner can change this board."] };
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
  const stored = typeof id === "string" ? getBoard(id) : null;
  if (!stored || stored.ownerId !== user.id) return { ok: false, errors: ["Only the owner can change this board."] };
  if (typeof links !== "object" || links === null || Array.isArray(links)) return { ok: false, errors: ["Invalid links."] };
  const own: Record<string, unknown> = { ...stored, links };
  for (const key of ["id", "createdAt", "ownerId", "ownerName"]) delete own[key];
  const prepared = prepare(own, id);
  if ("errors" in prepared) return { ok: false, errors: prepared.errors };
  if (!saveBoard(id, user.id, prepared.draft)) return { ok: false, errors: ["Only the owner can change this board."] };
  return { ok: true, id };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

// Deletes a board for good. A board that other boards use is kept, since they would break.
export async function deleteBoard(id: string): Promise<DeleteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to delete a board." };
  const stored = typeof id === "string" ? getBoard(id) : null;
  if (!stored || stored.ownerId !== user.id) return { ok: false, error: "Only the owner can delete this board." };
  const users = boardsUsing(id);
  if (users.length > 0) {
    const names = users.slice(0, 5).map((b) => `"${b.title}"`).join(", ");
    return {
      ok: false,
      error: `Other boards use this one: ${names}${users.length > 5 ? ` and ${users.length - 5} more` : ""}. Stop using it there first.`,
    };
  }
  if (!removeBoard(id, user.id)) return { ok: false, error: "Only the owner can delete this board." };
  return { ok: true };
}
