"use server";

import { getCurrentUser } from "@/lib/auth";
import { addView, getBoard } from "@/lib/db";
import { canOpen } from "@/lib/visibility";

// Counts a visit to a board, for the popularity sort. Your own visits don't count, and a board you can't open isn't
// counted at all.
export async function recordView(boardId: unknown): Promise<void> {
  if (typeof boardId !== "string") return;
  const user = await getCurrentUser();
  const board = getBoard(boardId);
  if (!board || !canOpen(board, user?.id)) return;
  if (user && board.ownerId === user.id) return;
  addView(boardId);
}
