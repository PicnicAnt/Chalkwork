import type Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

// Copies of the database. SQLite's own backup is used, so a copy is consistent even while the site is
// being used. One is made automatically when the server starts if the newest is more than a day old, and
// `npm run backup` makes one on demand. The newest `keep` copies are kept.
const PREFIX = "chalkwork-";

const stamp = (d: Date) => d.toISOString().replace(/[:T]/g, "-").slice(0, 19);

export function listBackups(dir: string): { file: string; time: number }[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.startsWith(PREFIX) && f.endsWith(".db"))
      .map((f) => ({ file: path.join(dir, f), time: statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
  } catch {
    return [];
  }
}

export async function backupDatabase(db: Database.Database, dir: string, keep = 14, now = new Date()): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${PREFIX}${stamp(now)}.db`);
  await db.backup(file);
  for (const old of listBackups(dir).slice(keep)) unlinkSync(old.file);
  return file;
}

// Makes a copy unless there is one from the last `maxAgeMs`. Returns the new file, or null.
export async function backupIfDue(db: Database.Database, dir: string, maxAgeMs = 24 * 60 * 60 * 1000): Promise<string | null> {
  const newest = listBackups(dir)[0];
  if (newest && Date.now() - newest.time < maxAgeMs) return null;
  return backupDatabase(db, dir);
}
