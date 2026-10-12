import "server-only";
import { getBoard, listAllBoards } from "./db";

// The boards a person can add to a board, for the pickers: with the names of the presets each has, so a board can be
// added as one of them.
export function boardChoices(viewerId: string) {
  return listAllBoards(1000, viewerId).map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    ownerName: b.ownerName,
    presets: (getBoard(b.id)?.presets ?? []).map((p) => p.name),
  }));
}
