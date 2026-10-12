import "server-only";
import { getCurrentUser } from "./auth";
import type { Board } from "./board-draft";
import { getBoard } from "./db";
import { canOpen } from "./visibility";

// A board as the person asking may see it: a private board is not found for anyone but its owner.
export async function getVisibleBoard(id: string): Promise<Board | null> {
  const board = getBoard(id);
  if (!board) return null;
  const user = await getCurrentUser();
  return canOpen(board, user?.id) ? board : null;
}
