import type { BoardDraft } from "../board-draft";
import { db } from "./client";

// The history of a board. Every save adds a numbered version; nothing is ever changed or removed (except with
// the board). Boards that use a board can pin one of its versions.
export type BoardVersion = { version: number; savedAt: string; savedByName: string | null; note: string; draft: BoardDraft };

export function latestVersion(boardId: string): number {
  const row = db.prepare("SELECT MAX(version) AS v FROM board_versions WHERE board_id = ?").get(boardId) as { v: number | null };
  return row.v ?? 0;
}

// Keeps the draft just saved as the next version of the board.
export function recordVersion(boardId: string, draft: BoardDraft, userId: string | null, note = ""): number {
  const version = latestVersion(boardId) + 1;
  db.prepare("INSERT INTO board_versions (board_id, version, draft, saved_by, note) VALUES (?, ?, ?, ?, ?)").run(boardId, version, JSON.stringify(draft), userId, note);
  return version;
}

export function getVersion(boardId: string, version: number): BoardDraft | null {
  const row = db.prepare("SELECT draft FROM board_versions WHERE board_id = ? AND version = ?").get(boardId, version) as { draft: string } | undefined;
  return row ? (JSON.parse(row.draft) as BoardDraft) : null;
}

// Newest first.
export function listVersions(boardId: string): BoardVersion[] {
  const rows = db
    .prepare(
      `SELECT v.version, v.saved_at, v.note, v.draft, u.name AS saved_by_name
       FROM board_versions v LEFT JOIN users u ON u.id = v.saved_by
       WHERE v.board_id = ? ORDER BY v.version DESC`,
    )
    .all(boardId) as { version: number; saved_at: string; note: string; draft: string; saved_by_name: string | null }[];
  return rows.map((r) => ({ version: r.version, savedAt: r.saved_at, savedByName: r.saved_by_name, note: r.note, draft: JSON.parse(r.draft) as BoardDraft }));
}
