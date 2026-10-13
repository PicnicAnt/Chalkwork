"use client";

import { useMemo } from "react";
import { AddBoards, type BoardType } from "./AddBoards";
import type { ExtraItem } from "@/lib/resolve-boards";

export type CollectionView = {
  name: string;
  title: string;
  /** The stats that are added up, or empty for every variable the items have. */
  stats: string[];
  /** Items the board's creator put in, which can't be taken out here. */
  fixed: { title: string }[];
  /** Items added by whoever is using the board. */
  added: { index: number; alias: string; title: string }[];
  /** The boards that can be added, each followed by its presets; absent when adding needs a sign-in. */
  choices?: { board: string; preset?: string; title: string; boardTitle?: string }[];
};

// Where people using a board add existing boards to one of its collections. It sits inside the collection's own box.
// Each board that can be added has its own Add button, with its presets to choose from. Each board's variables are added up
// into the collection's totals, which the board's formulas use. The boards are kept in the address.
export function ItemControls({ collection: c, extras, onChange }: { collection: CollectionView; extras: ExtraItem[]; onChange: (extras: ExtraItem[]) => void }) {
  // One entry per board, with the presets it has.
  const types = useMemo(() => {
    const out: BoardType[] = [];
    for (const ch of c.choices ?? []) {
      if (!ch.preset) out.push({ board: ch.board, title: ch.title, presets: [] });
      else out.find((t) => t.board === ch.board)?.presets?.push(ch.preset);
    }
    return out;
  }, [c.choices]);
  return (
    <div className="flex flex-col gap-2" aria-label={`Boards in ${c.title}`}>
      {c.choices === undefined ? (
        <p className="text-base text-ink-muted">Sign in to add boards.</p>
      ) : (
        <AddBoards types={types} onAdd={(board, preset) => onChange([...extras, { group: c.name, board, ...(preset ? { preset } : {}) }])} />
      )}
    </div>
  );
}
