"use client";

import { AddBoards } from "./AddBoards";

// In the editor's "Try it" section: boards added to a collection to see how it works out, added the same way as on the
// board. They are only for trying and aren't saved; people using the board add their own.
export function TryItems({
  boards,
  busy,
  onAdd,
}: {
  /** The boards that can be added: the ones the collection lists, or every board. */
  boards: { id: string; title: string }[];
  busy: boolean;
  onAdd: (boardId: string, preset?: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base text-ink-muted">
        Try it: add boards here to see the totals. People using the board add their own the same way; these aren&apos;t saved.
      </p>
      <AddBoards types={boards.map((b) => ({ board: b.id, title: b.title }))} busy={busy} onAdd={onAdd} />
    </div>
  );
}
