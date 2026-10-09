"use server";

import { getCurrentUser } from "@/lib/auth";
import { getBoard, getVersion, saveBoard } from "@/lib/db";
import { notifyBoardChanged } from "./notify";
import { prepare } from "./prepare";

export type RestoreResult = { ok: true } | { ok: false; error: string };

// The board becomes what it was in an earlier version. Nothing is lost: the restore is itself saved as the
// newest version, so it can be undone by restoring the one before.
export async function restoreVersion(boardId: string, version: number): Promise<RestoreResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const board = typeof boardId === "string" ? getBoard(boardId) : null;
  if (!board || board.ownerId !== user.id) return { ok: false, error: "Only the owner can restore a version." };
  const draft = Number.isInteger(version) ? getVersion(boardId, version) : null;
  if (!draft) return { ok: false, error: "That version doesn't exist." };
  // The same checks as any save: the boards it used may have changed since.
  const prepared = prepare(draft, boardId);
  if ("errors" in prepared) return { ok: false, error: `It no longer fits: ${prepared.errors.join(" ")}` };
  if (!saveBoard(boardId, user.id, prepared.draft, `Restored version ${version}`)) return { ok: false, error: "Only the owner can restore a version." };
  notifyBoardChanged(boardId, user.id);
  return { ok: true };
}
