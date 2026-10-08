import "server-only";
import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Calculation, CalculationDraft } from "./calculation";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "chalkwork.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const version = db.pragma("user_version", { simple: true }) as number;
if (version < 2) {
  // Version 1 stored separate inputs/outputs. It only ever held local test data, so start fresh.
  db.exec(`
    DROP TABLE IF EXISTS calculations;
    CREATE TABLE calculations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      formulas TEXT NOT NULL,
      input_values TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
}
if (version < 3) {
  // Editing used to be done with a secret edit key (edit_key_hash). Ownership by user replaced it
  // in version 8; the column is left in place, unused.
  db.exec(`
    ALTER TABLE calculations ADD COLUMN edit_key_hash TEXT;
    ALTER TABLE calculations ADD COLUMN updated_at TEXT;
  `);
  db.pragma("user_version = 3");
}
if (version < 4) {
  // A short description per variable, as JSON keyed by variable name.
  db.exec(`ALTER TABLE calculations ADD COLUMN variable_descriptions TEXT NOT NULL DEFAULT '{}';`);
  db.pragma("user_version = 4");
}
if (version < 5) {
  // A unit label per variable, as JSON keyed by variable name.
  db.exec(`ALTER TABLE calculations ADD COLUMN variable_units TEXT NOT NULL DEFAULT '{}';`);
  db.pragma("user_version = 5");
}
if (version < 6) {
  // Decimals to show per variable, as JSON keyed by variable name.
  db.exec(`ALTER TABLE calculations ADD COLUMN variable_decimals TEXT NOT NULL DEFAULT '{}';`);
  db.pragma("user_version = 6");
}
if (version < 7) {
  // A display name per variable, as JSON keyed by variable name.
  db.exec(`ALTER TABLE calculations ADD COLUMN variable_labels TEXT NOT NULL DEFAULT '{}';`);
  db.pragma("user_version = 7");
}
if (version < 8) {
  // Users, their login sessions, and the owner of each calculation. A user is identified by the
  // sign-in provider that vouched for them ("dev" for the test login, later "google") and that
  // provider's own id for them. Calculations made before this have no owner (owner_id is NULL):
  // anyone can view them, nobody can edit them, and anyone signed in can copy them.
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (provider, account_id)
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX sessions_user ON sessions(user_id);
    ALTER TABLE calculations ADD COLUMN owner_id TEXT REFERENCES users(id);
    CREATE INDEX calculations_owner ON calculations(owner_id);
  `);
  db.pragma("user_version = 8");
}
if (version < 9) {
  // Which variables are hidden from the board, as JSON keyed by variable name.
  db.exec(`ALTER TABLE calculations ADD COLUMN variable_hidden TEXT NOT NULL DEFAULT '{}';`);
  db.pragma("user_version = 9");
}
if (version < 10) {
  // The boards a board uses, as JSON: [{ "board": id, "alias": name }].
  db.exec(`ALTER TABLE calculations ADD COLUMN board_includes TEXT NOT NULL DEFAULT '[]';`);
  db.pragma("user_version = 10");
}
if (version < 11) {
  // Variables linked to another variable, as JSON: { "variable": "other variable" }.
  db.exec(`ALTER TABLE calculations ADD COLUMN variable_links TEXT NOT NULL DEFAULT '{}';`);
  db.pragma("user_version = 11");
}
if (version < 12) {
  // Suggested changes: another user proposes a new version of a board (the draft, as JSON) that the
  // owner approves or rejects. base_stamp is when the board was last changed at the time, to notice
  // that it has changed since.
  db.exec(`
    CREATE TABLE suggestions (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      draft TEXT NOT NULL,
      base_stamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      decision_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      decided_at TEXT
    );
    CREATE INDEX suggestions_board ON suggestions(board_id);
    CREATE INDEX suggestions_author ON suggestions(author_id);
  `);
  db.pragma("user_version = 12");
}
if (version < 13) {
  // Decimals are numbers. Some boards (made by the seed script) held them as text, which made a
  // suggestion look like it changed a decimal from "2" to 2.
  const rows = db.prepare("SELECT id, variable_decimals FROM calculations").all() as { id: string; variable_decimals: string }[];
  const fix = db.prepare("UPDATE calculations SET variable_decimals = ? WHERE id = ?");
  for (const row of rows) {
    const parsed = JSON.parse(row.variable_decimals || "{}") as Record<string, unknown>;
    if (!Object.values(parsed).some((v) => typeof v === "string")) continue;
    const fixed = Object.fromEntries(
      Object.entries(parsed).flatMap(([k, v]) => (Number.isFinite(Number(v)) && v !== "" ? [[k, Number(v)]] : [])),
    );
    fix.run(JSON.stringify(fixed), row.id);
  }
  db.pragma("user_version = 13");
}

// ---------------------------------------------------------------------------
// Users and sessions

export type UserRow = { id: string; provider: string; name: string };

// Finds the user for this provider account, or creates one. The name is only set on creation, so
// a provider can't rename someone later by sending a different name.
export function upsertUser(profile: { provider: string; accountId: string; name: string }): UserRow {
  const existing = db
    .prepare("SELECT id, provider, name FROM users WHERE provider = ? AND account_id = ?")
    .get(profile.provider, profile.accountId) as UserRow | undefined;
  if (existing) return existing;
  const id = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO users (id, provider, account_id, name) VALUES (?, ?, ?, ?)").run(
    id,
    profile.provider,
    profile.accountId,
    profile.name,
  );
  return { id, provider: profile.provider, name: profile.name };
}

export function listUsers(provider: string, limit = 50): (UserRow & { boards: number })[] {
  return db
    .prepare(
      `SELECT u.id, u.provider, u.name,
         (SELECT COUNT(*) FROM calculations c WHERE c.owner_id = u.id) AS boards
       FROM users u WHERE u.provider = ? ORDER BY lower(u.name) LIMIT ?`,
    )
    .all(provider, limit) as (UserRow & { boards: number })[];
}

// Sessions are looked up by the SHA-256 of the cookie's token, so the database never holds a value
// that could be used to sign in.
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createSession(tokenHash: string, userId: string, expiresAt: Date) {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash,
    userId,
    expiresAt.toISOString(),
  );
}

export function getSessionUser(tokenHash: string): UserRow | null {
  const row = db
    .prepare(
      `SELECT u.id, u.provider, u.name FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, new Date().toISOString()) as UserRow | undefined;
  return row ?? null;
}

export function deleteSession(tokenHash: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

// ---------------------------------------------------------------------------
// Calculations

type Row = {
  id: string;
  title: string;
  description: string;
  formulas: string;
  input_values: string;
  variable_descriptions: string;
  variable_units: string;
  variable_decimals: string;
  variable_labels: string;
  variable_hidden: string;
  board_includes: string;
  variable_links: string;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
};

export function insertCalculation(draft: CalculationDraft, ownerId: string): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare(
    `INSERT INTO calculations (id, title, description, formulas, input_values, variable_descriptions,
       variable_units, variable_decimals, variable_labels, variable_hidden, board_includes, variable_links, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    draft.title,
    draft.description,
    JSON.stringify(draft.formulas),
    JSON.stringify(draft.values),
    JSON.stringify(draft.descriptions),
    JSON.stringify(draft.units),
    JSON.stringify(draft.decimals),
    JSON.stringify(draft.labels),
    JSON.stringify(draft.hidden),
    JSON.stringify(draft.includes),
    JSON.stringify(draft.links),
    ownerId,
  );
  return id;
}

// Only the owner's own calculation is changed: the ownership check is part of the statement.
export function updateCalculation(id: string, ownerId: string, draft: CalculationDraft): boolean {
  const result = db
    .prepare(
      `UPDATE calculations SET title = ?, description = ?, formulas = ?, input_values = ?,
         variable_descriptions = ?, variable_units = ?, variable_decimals = ?, variable_labels = ?, variable_hidden = ?,
         board_includes = ?, variable_links = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND owner_id = ?`,
    )
    .run(
      draft.title,
      draft.description,
      JSON.stringify(draft.formulas),
      JSON.stringify(draft.values),
      JSON.stringify(draft.descriptions),
      JSON.stringify(draft.units),
      JSON.stringify(draft.decimals),
      JSON.stringify(draft.labels),
      JSON.stringify(draft.hidden),
      JSON.stringify(draft.includes),
      JSON.stringify(draft.links),
      id,
      ownerId,
    );
  return result.changes > 0;
}

const parse = (row: Row): Calculation => ({
  id: row.id,
  title: row.title,
  description: row.description,
  formulas: JSON.parse(row.formulas),
  values: JSON.parse(row.input_values),
  descriptions: JSON.parse(row.variable_descriptions || "{}"),
  units: JSON.parse(row.variable_units || "{}"),
  labels: JSON.parse(row.variable_labels || "{}"),
  decimals: JSON.parse(row.variable_decimals || "{}"),
  hidden: JSON.parse(row.variable_hidden || "{}"),
  includes: JSON.parse(row.board_includes || "[]"),
  links: JSON.parse(row.variable_links || "{}"),
  createdAt: row.created_at,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
});

export function getCalculation(id: string): Calculation | null {
  const row = db
    .prepare(
      `SELECT c.*, u.name AS owner_name FROM calculations c LEFT JOIN users u ON u.id = c.owner_id
       WHERE c.id = ?`,
    )
    .get(id) as Row | undefined;
  return row ? parse(row) : null;
}

export function listCalculationsByOwner(ownerId: string): { id: string; title: string; createdAt: string }[] {
  return (
    db
      .prepare("SELECT id, title, created_at FROM calculations WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(ownerId) as { id: string; title: string; created_at: string }[]
  ).map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at }));
}

export type BoardSummary = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
};

// Every calculation by every user, newest first, for the browse page.
export function listAllCalculations(limit = 1000): BoardSummary[] {
  return (
    db
      .prepare(
        `SELECT c.id, c.title, c.description, c.created_at, c.owner_id, u.name AS owner_name
         FROM calculations c LEFT JOIN users u ON u.id = c.owner_id
         ORDER BY c.created_at DESC LIMIT ?`,
      )
      .all(limit) as {
      id: string;
      title: string;
      description: string;
      created_at: string;
      owner_id: string | null;
      owner_name: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
  }));
}

// The boards that use this one, by title, so it is not deleted from under them.
export function boardsUsing(id: string): { id: string; title: string }[] {
  const rows = db
    .prepare("SELECT id, title, board_includes FROM calculations WHERE id != ? AND board_includes LIKE ?")
    .all(id, `%${id}%`) as { id: string; title: string; board_includes: string }[];
  return rows
    .filter((row) => {
      try {
        return (JSON.parse(row.board_includes) as { board?: string }[]).some((inc) => inc.board === id);
      } catch {
        return false;
      }
    })
    .map(({ id, title }) => ({ id, title }));
}

// Only the owner's own board is deleted: the ownership check is part of the statement.
export function deleteCalculation(id: string, ownerId: string): boolean {
  return db.prepare("DELETE FROM calculations WHERE id = ? AND owner_id = ?").run(id, ownerId).changes > 0;
}

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
