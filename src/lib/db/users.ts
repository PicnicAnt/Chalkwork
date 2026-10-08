import { createHash, randomBytes } from "node:crypto";
import { db } from "./client";

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
