import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrate } from "./migrations";

// The one connection to the database, opened (and brought up to date) when the server first needs it.
const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "chalkwork.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
migrate(db);
