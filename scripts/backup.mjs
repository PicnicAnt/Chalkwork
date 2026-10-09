// Makes a copy of the database in data/backups. Run with `npm run backup`. The newest 14 copies are kept.
// The site makes one by itself when it starts, if the newest is more than a day old.
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dir = path.join(dataDir, "backups");
mkdirSync(dir, { recursive: true });

const db = new Database(path.join(dataDir, "chalkwork.db"), { readonly: true });
const name = `chalkwork-${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}.db`;
await db.backup(path.join(dir, name));
db.close();

const old = readdirSync(dir)
  .filter((f) => f.startsWith("chalkwork-") && f.endsWith(".db"))
  .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(14);
for (const { f } of old) unlinkSync(path.join(dir, f));
console.log(`Backed up to data/backups/${name}${old.length ? ` (removed ${old.length} older)` : ""}`);
