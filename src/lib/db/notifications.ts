import { randomBytes } from "node:crypto";
import { db } from "./client";

// The notifications that tell people about what happened to boards they care about.

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
