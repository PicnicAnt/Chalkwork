import { randomBytes } from "node:crypto";
import type { Board, BoardDraft } from "../board-draft";
import { db } from "./client";
import { recordVersion } from "./versions";

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
  variable_ranges: string;
  board_tables: string;
  board_tags: string;
  variable_labels: string;
  variable_hidden: string;
  board_includes: string;
  variable_links: string;
  visualizations: string;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
};

export function insertBoard(draft: BoardDraft, ownerId: string): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare(
    `INSERT INTO calculations (id, title, description, formulas, input_values, variable_descriptions,
       variable_units, variable_decimals, variable_ranges, board_tables, board_tags, variable_labels, variable_hidden, board_includes, variable_links, visualizations, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    draft.title,
    draft.description,
    JSON.stringify(draft.formulas),
    JSON.stringify(draft.values),
    JSON.stringify(draft.descriptions),
    JSON.stringify(draft.units),
    JSON.stringify(draft.decimals),
    JSON.stringify(draft.ranges),
    JSON.stringify(draft.tables),
    JSON.stringify(draft.tags),
    JSON.stringify(draft.labels),
    JSON.stringify(draft.hidden),
    JSON.stringify(draft.includes),
    JSON.stringify(draft.links),
    JSON.stringify(draft.visualizations),
    ownerId,
  );
  recordVersion(id, draft, ownerId);
  return id;
}

// Only the owner's own calculation is changed: the ownership check is part of the statement.
// `note` says why, for the history ("Restored version 3").
export function saveBoard(id: string, ownerId: string, draft: BoardDraft, note = ""): boolean {
  const result = db
    .prepare(
      `UPDATE calculations SET title = ?, description = ?, formulas = ?, input_values = ?,
         variable_descriptions = ?, variable_units = ?, variable_decimals = ?, variable_ranges = ?, board_tables = ?, board_tags = ?, variable_labels = ?, variable_hidden = ?,
         board_includes = ?, variable_links = ?, visualizations = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
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
      JSON.stringify(draft.ranges),
      JSON.stringify(draft.tables),
      JSON.stringify(draft.tags),
    JSON.stringify(draft.tags),
    JSON.stringify(draft.tables),
    JSON.stringify(draft.tags),
    JSON.stringify(draft.ranges),
    JSON.stringify(draft.tables),
    JSON.stringify(draft.tags),
      JSON.stringify(draft.labels),
      JSON.stringify(draft.hidden),
      JSON.stringify(draft.includes),
      JSON.stringify(draft.links),
      JSON.stringify(draft.visualizations),
      id,
      ownerId,
    );
  if (result.changes === 0) return false;
  recordVersion(id, draft, ownerId, note);
  return true;
}

const parse = (row: Row): Board => ({
  id: row.id,
  title: row.title,
  description: row.description,
  formulas: JSON.parse(row.formulas),
  values: JSON.parse(row.input_values),
  descriptions: JSON.parse(row.variable_descriptions || "{}"),
  units: JSON.parse(row.variable_units || "{}"),
  labels: JSON.parse(row.variable_labels || "{}"),
  decimals: JSON.parse(row.variable_decimals || "{}"),
  ranges: JSON.parse(row.variable_ranges || "{}"),
  tables: JSON.parse(row.board_tables || "[]"),
  tags: JSON.parse(row.board_tags || "[]"),
  hidden: JSON.parse(row.variable_hidden || "{}"),
  includes: JSON.parse(row.board_includes || "[]"),
  links: JSON.parse(row.variable_links || "{}"),
  visualizations: JSON.parse(row.visualizations || "[]"),
  createdAt: row.created_at,
  ownerId: row.owner_id,
  ownerName: row.owner_name,
});

export function getBoard(id: string): Board | null {
  const row = db
    .prepare(
      `SELECT c.*, u.name AS owner_name FROM calculations c LEFT JOIN users u ON u.id = c.owner_id
       WHERE c.id = ?`,
    )
    .get(id) as Row | undefined;
  return row ? parse(row) : null;
}

export function listBoardsByOwner(ownerId: string): { id: string; title: string; createdAt: string }[] {
  return (
    db
      .prepare("SELECT id, title, created_at FROM calculations WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(ownerId) as { id: string; title: string; created_at: string }[]
  ).map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at }));
}

function safeJson<T>(text: string | null, fallback: T): T {
  try {
    return JSON.parse(text || "") as T;
  } catch {
    return fallback;
  }
}

export type BoardSummary = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  tags: string[];
  /** The formulas and the display names, so a board can be found by what it calculates. */
  keywords: string;
};

// Every calculation by every user, newest first, for the browse page.
export function listAllBoards(limit = 1000): BoardSummary[] {
  return (
    db
      .prepare(
        `SELECT c.id, c.title, c.description, c.created_at, c.owner_id, u.name AS owner_name, c.board_tags, c.formulas, c.variable_labels
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
      board_tags: string;
      formulas: string;
      variable_labels: string;
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    tags: safeJson<string[]>(r.board_tags, []),
    keywords: [...safeJson<string[]>(r.formulas, []), ...Object.values(safeJson<Record<string, string>>(r.variable_labels, {}))].join("\n"),
  }));
}

// The boards that use this one, by title, so it is not deleted from under them.
export function boardsUsing(id: string): { id: string; title: string; ownerId: string | null }[] {
  const rows = db
    .prepare("SELECT id, title, owner_id, board_includes FROM calculations WHERE id != ? AND board_includes LIKE ?")
    .all(id, `%${id}%`) as { id: string; title: string; owner_id: string | null; board_includes: string }[];
  return rows
    .filter((row) => {
      try {
        return (JSON.parse(row.board_includes) as { board?: string }[]).some((inc) => inc.board === id);
      } catch {
        return false;
      }
    })
    .map(({ id, title, owner_id }) => ({ id, title, ownerId: owner_id }));
}

// Only the owner's own board is deleted: the ownership check is part of the statement.
export function removeBoard(id: string, ownerId: string): boolean {
  return db.prepare("DELETE FROM calculations WHERE id = ? AND owner_id = ?").run(id, ownerId).changes > 0;
}
