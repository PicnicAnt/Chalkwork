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

const SCHEMA_VERSION = 2;
if ((db.pragma("user_version", { simple: true }) as number) < SCHEMA_VERSION) {
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
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

type Row = {
  id: string;
  title: string;
  description: string;
  formulas: string;
  input_values: string;
  created_at: string;
};

export function insertCalculation(draft: CalculationDraft): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare(
    "INSERT INTO calculations (id, title, description, formulas, input_values) VALUES (?, ?, ?, ?, ?)",
  ).run(id, draft.title, draft.description, JSON.stringify(draft.formulas), JSON.stringify(draft.values));
  return id;
}

export function getCalculation(id: string): Calculation | null {
  const row = db.prepare("SELECT * FROM calculations WHERE id = ?").get(id) as Row | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    formulas: JSON.parse(row.formulas),
    values: JSON.parse(row.input_values),
    createdAt: row.created_at,
  };
}
