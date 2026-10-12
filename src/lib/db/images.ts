import { db } from "./client";

// The picture a person gave a board, as a data URL, or null when it has none.
export function getBoardImage(boardId: string): string | null {
  const row = db.prepare("SELECT image FROM board_images WHERE board_id = ?").get(boardId) as { image: string } | undefined;
  return row?.image ?? null;
}

// Sets the picture, or removes it with an empty text.
export function setBoardImage(boardId: string, image: string): void {
  if (!image) db.prepare("DELETE FROM board_images WHERE board_id = ?").run(boardId);
  else db.prepare("INSERT INTO board_images (board_id, image) VALUES (?, ?) ON CONFLICT(board_id) DO UPDATE SET image = excluded.image").run(boardId, image);
}
