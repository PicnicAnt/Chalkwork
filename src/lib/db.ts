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
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
};

export function insertCalculation(draft: CalculationDraft, ownerId: string): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare(
    `INSERT INTO calculations (id, title, description, formulas, input_values, variable_descriptions,
       variable_units, variable_decimals, variable_labels, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ownerId,
  );
  return id;
}

// Only the owner's own calculation is changed: the ownership check is part of the statement.
export function updateCalculation(id: string, ownerId: string, draft: CalculationDraft): boolean {
  const result = db
    .prepare(
      `UPDATE calculations SET title = ?, description = ?, formulas = ?, input_values = ?,
         variable_descriptions = ?, variable_units = ?, variable_decimals = ?, variable_labels = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
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
