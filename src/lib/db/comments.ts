import { randomBytes } from "node:crypto";
import { db } from "./client";

export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  /** The variable it is about, or "" for the board as a whole. */
  variable: string;
  body: string;
  createdAt: string;
};

type Row = { id: string; author_id: string; author_name: string; variable: string; body: string; created_at: string };

// Oldest first, so a thread reads in the order it was written.
export function listComments(boardId: string): Comment[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.author_id, u.name AS author_name, c.variable, c.body, c.created_at
       FROM board_comments c JOIN users u ON u.id = c.author_id
       WHERE c.board_id = ? ORDER BY c.created_at ASC, c.rowid ASC`,
    )
    .all(boardId) as Row[];
  return rows.map((r) => ({ id: r.id, authorId: r.author_id, authorName: r.author_name, variable: r.variable, body: r.body, createdAt: r.created_at }));
}

export function countComments(boardId: string): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM board_comments WHERE board_id = ?").get(boardId) as { n: number }).n;
}

export function insertComment(boardId: string, authorId: string, variable: string, body: string): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO board_comments (id, board_id, author_id, variable, body) VALUES (?, ?, ?, ?, ?)").run(id, boardId, authorId, variable, body);
  return id;
}

export function getComment(id: string): { id: string; boardId: string; authorId: string } | null {
  const row = db.prepare("SELECT id, board_id, author_id FROM board_comments WHERE id = ?").get(id) as { id: string; board_id: string; author_id: string } | undefined;
  return row ? { id: row.id, boardId: row.board_id, authorId: row.author_id } : null;
}

export function removeComment(id: string): void {
  db.prepare("DELETE FROM board_comments WHERE id = ?").run(id);
}
