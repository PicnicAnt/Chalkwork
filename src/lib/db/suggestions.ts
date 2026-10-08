import { randomBytes } from "node:crypto";
import type { CalculationDraft } from "../calculation";
import { db } from "./client";

// ---------------------------------------------------------------------------
// Suggested changes

export type SuggestionStatus = "open" | "approved" | "rejected" | "withdrawn";

export type Suggestion = {
  id: string;
  boardId: string;
  boardTitle: string;
  boardOwnerId: string | null;
  authorId: string;
  authorName: string;
  message: string;
  draft: CalculationDraft;
  baseStamp: string;
  status: SuggestionStatus;
  decisionNote: string;
  createdAt: string;
  decidedAt: string | null;
};

type SuggestionRow = {
  id: string;
  board_id: string;
  board_title: string;
  board_owner_id: string | null;
  author_id: string;
  author_name: string;
  message: string;
  draft: string;
  base_stamp: string;
  status: SuggestionStatus;
  decision_note: string;
  created_at: string;
  decided_at: string | null;
};

const SUGGESTION_SELECT = `
  SELECT s.id, s.board_id, c.title AS board_title, c.owner_id AS board_owner_id, s.author_id,
         u.name AS author_name, s.message, s.draft, s.base_stamp, s.status, s.decision_note,
         s.created_at, s.decided_at
  FROM suggestions s
  JOIN calculations c ON c.id = s.board_id
  JOIN users u ON u.id = s.author_id`;

const toSuggestion = (r: SuggestionRow): Suggestion => ({
  id: r.id,
  boardId: r.board_id,
  boardTitle: r.board_title,
  boardOwnerId: r.board_owner_id,
  authorId: r.author_id,
  authorName: r.author_name,
  message: r.message,
  draft: JSON.parse(r.draft),
  baseStamp: r.base_stamp,
  status: r.status,
  decisionNote: r.decision_note,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
});

// When the board was last changed; a suggestion remembers it to notice later changes.
export function boardStamp(id: string): string | null {
  const row = db.prepare("SELECT COALESCE(updated_at, created_at) AS stamp FROM calculations WHERE id = ?").get(id) as
    | { stamp: string }
    | undefined;
  return row?.stamp ?? null;
}

export function insertSuggestion(input: {
  boardId: string;
  authorId: string;
  message: string;
  draft: CalculationDraft;
  baseStamp: string;
}): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare(
    "INSERT INTO suggestions (id, board_id, author_id, message, draft, base_stamp) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, input.boardId, input.authorId, input.message, JSON.stringify(input.draft), input.baseStamp);
  return id;
}

export function getSuggestion(id: string): Suggestion | null {
  const row = db.prepare(`${SUGGESTION_SELECT} WHERE s.id = ?`).get(id) as SuggestionRow | undefined;
  return row ? toSuggestion(row) : null;
}

const ORDER = "ORDER BY (s.status = 'open') DESC, s.created_at DESC";

export function listSuggestionsForBoard(boardId: string): Suggestion[] {
  return (db.prepare(`${SUGGESTION_SELECT} WHERE s.board_id = ? ${ORDER}`).all(boardId) as SuggestionRow[]).map(
    toSuggestion,
  );
}

export function listSuggestionsByAuthor(authorId: string, limit = 100): Suggestion[] {
  return (
    db.prepare(`${SUGGESTION_SELECT} WHERE s.author_id = ? ${ORDER} LIMIT ?`).all(authorId, limit) as SuggestionRow[]
  ).map(toSuggestion);
}

// Suggestions on the boards a user owns, open ones first.
export function listSuggestionsForOwner(ownerId: string, limit = 100): Suggestion[] {
  return (
    db.prepare(`${SUGGESTION_SELECT} WHERE c.owner_id = ? ${ORDER} LIMIT ?`).all(ownerId, limit) as SuggestionRow[]
  ).map(toSuggestion);
}

export function countOpenSuggestionsForOwner(ownerId: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM suggestions s JOIN calculations c ON c.id = s.board_id WHERE c.owner_id = ? AND s.status = 'open'",
    )
    .get(ownerId) as { n: number };
  return row.n;
}

export function countOpenSuggestionsByAuthorOnBoard(authorId: string, boardId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM suggestions WHERE author_id = ? AND board_id = ? AND status = 'open'")
    .get(authorId, boardId) as { n: number };
  return row.n;
}

// Only an open suggestion can be decided, and only once.
export function decideSuggestion(id: string, status: Exclude<SuggestionStatus, "open">, note: string): boolean {
  return (
    db
      .prepare(
        "UPDATE suggestions SET status = ?, decision_note = ?, decided_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'open'",
      )
      .run(status, note, id).changes > 0
  );
}
