import { randomBytes } from "node:crypto";
import type { Scenario, ScenarioSnapshot } from "../scenarios";
import { db } from "./client";

// A user's own saved sets of values for a board, oldest first.
export function listScenarios(boardId: string, userId: string): Scenario[] {
  const rows = db
    .prepare("SELECT id, name, snapshot FROM scenarios WHERE board_id = ? AND user_id = ? ORDER BY created_at, rowid")
    .all(boardId, userId) as { id: string; name: string; snapshot: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name, ...(JSON.parse(r.snapshot) as ScenarioSnapshot) }));
}

export function countScenarios(boardId: string, userId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM scenarios WHERE board_id = ? AND user_id = ?").get(boardId, userId) as { n: number };
  return row.n;
}

export function insertScenario(boardId: string, userId: string, name: string, snapshot: ScenarioSnapshot): string {
  const id = randomBytes(9).toString("base64url");
  db.prepare("INSERT INTO scenarios (id, board_id, user_id, name, snapshot) VALUES (?, ?, ?, ?, ?)").run(id, boardId, userId, name, JSON.stringify(snapshot));
  return id;
}

// Only the user's own scenario is removed: the owner check is part of the statement.
export function removeScenario(id: string, userId: string): boolean {
  return db.prepare("DELETE FROM scenarios WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}
