import { randomBytes } from "node:crypto";
import { db } from "./client";

// Comments on a board (or on one of its variables) and the notifications that tell people about what happened.

export type Comment = {
  id: string;
  boardId: string;
  userId: string;
  userName: string;
  /** The variable it is about, or null for the board as a whole. */
  variable: string | null;
  body: string;
  createdAt: string;
};

type CommentRow = { id: string; board_id: string; user_id: string; user_name: string; variable: string | null; body: string; created_at: string };

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  boardId: r.board_id,
  userId: r.user_id,
  userName: r.user_name,
  variable: r.variable,
  body: r.body,
  createdAt: r.created_at,
});

const COMMENT_SELECT = "SELECT c.id, c.board_id, c.user_id, u.name AS user_name, c.variable, c.body, c.created_at FROM comments c JOIN users u ON u.id = c.user_id";

export function listComments(boardId: string): Comment[] {
  return (db.prepare(`${COMMENT_SELECT} WHERE c.board_id = ? ORDER BY c.created_at, c.rowid LIMIT 500`).all(boardId) as CommentRow[]).map(toComment);
}

export function getComment(id: string): Comment | null {
  const row = db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(id) as CommentRow | undefined;
  return row ? toComment(row) : null;
}

export function insertComment(boardId: string, userId: string, variable: string | null, body: string): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO comments (id, board_id, user_id, variable, body) VALUES (?, ?, ?, ?, ?)").run(id, boardId, userId, variable, body);
  return id;
}

export function removeComment(id: string): boolean {
  return db.prepare("DELETE FROM comments WHERE id = ?").run(id).changes > 0;
}

/** How many comments a user wrote in the last hour, to keep a flood from one account in check. */
export function countRecentComments(userId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").get(userId) as { n: number };
  return row.n;
}

/** The people who have commented on a board. */
export function commenterIds(boardId: string): string[] {
  return (db.prepare("SELECT DISTINCT user_id FROM comments WHERE board_id = ?").all(boardId) as { user_id: string }[]).map((r) => r.user_id);
}

// ---------------------------------------------------------------------------
// Notifications

export type Notification = { id: string; kind: string; boardId: string | null; text: string; link: string; createdAt: string; read: boolean };

type NotificationRow = { id: string; kind: string; board_id: string | null; text: string; link: string; created_at: string; read_at: string | null };

// A new notification. If the same kind of thing is already waiting unread for the same person and board (several
// edits in a row), that one is updated instead, so an inbox doesn't fill with repeats.
export function insertNotification(n: { userId: string; kind: string; boardId: string | null; text: string; link: string }): void {
  const waiting = db
    .prepare("SELECT id FROM notifications WHERE user_id = ? AND kind = ? AND board_id IS ? AND read_at IS NULL")
    .get(n.userId, n.kind, n.boardId) as { id: string } | undefined;
  if (waiting) {
    db.prepare("UPDATE notifications SET text = ?, link = ?, created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(n.text, n.link, waiting.id);
    return;
  }
  db.prepare("INSERT INTO notifications (id, user_id, kind, board_id, text, link) VALUES (?, ?, ?, ?, ?, ?)").run(randomBytes(9).toString("base64url"), n.userId, n.kind, n.boardId, n.text, n.link);
}

export function listNotifications(userId: string, limit = 100): Notification[] {
  return (db.prepare("SELECT id, kind, board_id, text, link, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?").all(userId, limit) as NotificationRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    boardId: r.board_id,
    text: r.text,
    link: r.link,
    createdAt: r.created_at,
    read: r.read_at !== null,
  }));
}

export function countUnreadNotifications(userId: string): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").get(userId) as { n: number }).n;
}

export function markNotificationsRead(userId: string): void {
  db.prepare("UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND read_at IS NULL").run(userId);
}
