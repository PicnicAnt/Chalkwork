"use server";

import { getCurrentUser } from "@/lib/auth";
import { commenterIds, countRecentComments, getBoard, getComment, insertComment, markNotificationsRead, removeComment } from "@/lib/db";
import { notify } from "./notify";

// Comments on a board, and reading the inbox. Every action checks who is asking. Only signed-in people can see or
// write comments.

const MAX_COMMENT = 1000;
const MAX_PER_HOUR = 20;

export type CommentResult = { ok: true } | { ok: false; error: string };

export async function addComment(boardId: string, body: unknown, variable: unknown): Promise<CommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to comment." };
  const board = typeof boardId === "string" ? getBoard(boardId) : null;
  if (!board) return { ok: false, error: "That board doesn't exist." };
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > MAX_COMMENT) return { ok: false, error: `A comment can be at most ${MAX_COMMENT} characters.` };
  const about = typeof variable === "string" && variable.trim() ? variable.trim().slice(0, 120) : null;
  if (countRecentComments(user.id) >= MAX_PER_HOUR) return { ok: false, error: "That's a lot of comments in an hour. Try again a little later." };

  const before = commenterIds(boardId);
  insertComment(boardId, user.id, about, text);

  // The owner hears about it, and so does anyone who has commented before.
  const message = `${user.name} commented on ${board.title}.`;
  notify(board.ownerId, user.id, "comment", boardId, message, `/c/${boardId}#comments`);
  for (const other of before) if (other !== board.ownerId) notify(other, user.id, "comment", boardId, message, `/c/${boardId}#comments`);
  return { ok: true };
}

// A comment is removed by the person who wrote it or by the owner of the board.
export async function deleteComment(id: string): Promise<CommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const comment = typeof id === "string" ? getComment(id) : null;
  if (!comment) return { ok: false, error: "That comment is gone." };
  if (comment.userId !== user.id && getBoard(comment.boardId)?.ownerId !== user.id) return { ok: false, error: "Only the author or the owner of the board can remove this." };
  removeComment(id);
  return { ok: true };
}

export async function markAllRead(): Promise<void> {
  const user = await getCurrentUser();
  if (user) markNotificationsRead(user.id);
}
