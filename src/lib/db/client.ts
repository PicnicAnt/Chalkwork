import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { backupIfDue } from "./backup";
import { migrate } from "./migrations";

// The one connection to the database, opened (and brought up to date) when the server first needs it.
const dataDir = process.env.CHALKWORK_DATA_DIR || path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "chalkwork.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
migrate(db);

// A daily copy, made in the background. CHALKWORK_BACKUP=0 turns it off.
if (process.env.CHALKWORK_BACKUP !== "0" && process.env.NODE_ENV === "production") {
  backupIfDue(db, path.join(dataDir, "backups")).catch((error) => console.error("Backup failed:", error));
}
