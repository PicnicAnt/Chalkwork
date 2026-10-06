import "server-only";
import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Calculation, CalculationDraft } from "./calculation";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "calcshare.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS calculations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    inputs TEXT NOT NULL,
    outputs TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )
`);

type Row = { id: string; title: string; description: string; inputs: string; outputs: string; created_at: string };

export function insertCalculation(draft: CalculationDraft): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO calculations (id, title, description, inputs, outputs) VALUES (?, ?, ?, ?, ?)").run(
    id,
    draft.title,
    draft.description,
    JSON.stringify(draft.inputs),
    JSON.stringify(draft.outputs),
  );
  return id;
}

export function getCalculation(id: string): Calculation | null {
  const row = db.prepare("SELECT * FROM calculations WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    inputs: JSON.parse(row.inputs),
    outputs: JSON.parse(row.outputs),
    createdAt: row.created_at,
  };
}
