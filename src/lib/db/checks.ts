import type { Check } from "../checks";
import { db } from "./client";

export function getChecks(boardId: string): Check[] {
  const row = db.prepare("SELECT checks FROM board_checks WHERE board_id = ?").get(boardId) as { checks: string } | undefined;
  return row ? (JSON.parse(row.checks) as Check[]) : [];
}

// Sets the checks, or removes them all with an empty list.
export function setChecks(boardId: string, checks: Check[]): void {
  if (checks.length === 0) db.prepare("DELETE FROM board_checks WHERE board_id = ?").run(boardId);
  else db.prepare("INSERT INTO board_checks (board_id, checks) VALUES (?, ?) ON CONFLICT(board_id) DO UPDATE SET checks = excluded.checks").run(boardId, JSON.stringify(checks));
}
