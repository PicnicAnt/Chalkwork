"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { countComments, getBoard, getComment, insertComment, removeComment } from "@/lib/db";
import { COMMENT_LIMITS } from "@/lib/comments";
import { canOpen } from "@/lib/visibility";

// Comments on a board. Anyone signed in who can open the board can write one; it can be removed by its author and by
// the owner of the board.

export type CommentResult = { ok: true } | { ok: false; error: string };

const recent = new Map<string, number[]>();

export async function addComment(boardId: unknown, variable: unknown, body: unknown): Promise<CommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to write a comment." };
  const board = typeof boardId === "string" ? getBoard(boardId) : null;
  if (!board || !canOpen(board, user.id)) return { ok: false, error: "That board doesn't exist." };
  const text = typeof body === "string" ? body.trim() : "";
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > COMMENT_LIMITS.body) return { ok: false, error: `A comment can be at most ${COMMENT_LIMITS.body} characters.` };
  const about = typeof variable === "string" ? variable.trim().slice(0, 120) : "";
  const now = Date.now();
  const times = (recent.get(user.id) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= COMMENT_LIMITS.perMinute) return { ok: false, error: "Slow down a little: a few comments a minute." };
  if (countComments(board.id) >= COMMENT_LIMITS.perBoard) return { ok: false, error: "This board has as many comments as it can hold." };
  recent.set(user.id, [...times, now]);
  insertComment(board.id, user.id, about, text);
  revalidatePath(`/c/${board.id}`);
  return { ok: true };
}

export async function deleteComment(id: unknown): Promise<CommentResult> {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string") return { ok: false, error: "Sign in first." };
  const comment = getComment(id);
  if (!comment) return { ok: true };
  const board = getBoard(comment.boardId);
  if (!board || (comment.authorId !== user.id && board.ownerId !== user.id)) return { ok: false, error: "Only the writer or the owner of the board can remove a comment." };
  removeComment(id);
  revalidatePath(`/c/${comment.boardId}`);
  return { ok: true };
}
