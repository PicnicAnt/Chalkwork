import "server-only";
import Database from "better-sqlite3";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Calculation, CalculationDraft } from "./calculation";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "chalkwork.db"));
db.pragma("journal_mode = WAL");

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
  // Editing: the creator gets a secret edit key; only its hash is stored.
  // Calculations made before this have no key and can only be copied.
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

type Row = {
  id: string;
  title: string;
  description: string;
  formulas: string;
  input_values: string;
  variable_descriptions: string;
  created_at: string;
  edit_key_hash: string | null;
};

const hashKey = (key: string) => createHash("sha256").update(key).digest();

export function insertCalculation(draft: CalculationDraft): { id: string; editKey: string } {
  const id = randomBytes(9).toString("base64url");
  const editKey = randomBytes(18).toString("base64url");
  db.prepare(
    "INSERT INTO calculations (id, title, description, formulas, input_values, variable_descriptions, edit_key_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    draft.title,
    draft.description,
    JSON.stringify(draft.formulas),
    JSON.stringify(draft.values),
    JSON.stringify(draft.descriptions),
    hashKey(editKey).toString("hex"),
  );
  return { id, editKey };
}

export function canEdit(id: string, editKey: string): boolean {
  const row = db.prepare("SELECT edit_key_hash FROM calculations WHERE id = ?").get(id) as
    | Pick<Row, "edit_key_hash">
    | undefined;
  if (!row?.edit_key_hash) return false;
  return timingSafeEqual(Buffer.from(row.edit_key_hash, "hex"), hashKey(editKey));
}

export function updateCalculation(id: string, draft: CalculationDraft) {
  db.prepare(
    `UPDATE calculations SET title = ?, description = ?, formulas = ?, input_values = ?, variable_descriptions = ?,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(
    draft.title,
    draft.description,
    JSON.stringify(draft.formulas),
    JSON.stringify(draft.values),
    JSON.stringify(draft.descriptions),
    id,
  );
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
    descriptions: JSON.parse(row.variable_descriptions || "{}"),
    createdAt: row.created_at,
  };
}
