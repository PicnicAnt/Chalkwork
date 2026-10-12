import { db } from "./client";

// A board was opened by someone other than its owner.
export function addView(boardId: string): void {
  db.prepare("INSERT INTO board_views (board_id, views) VALUES (?, 1) ON CONFLICT(board_id) DO UPDATE SET views = views + 1").run(boardId);
}
