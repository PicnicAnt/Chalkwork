"use client";

import { useId, useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";

export type BoardChoice = { id: string; title: string; description: string; ownerName: string | null };

// "Add an existing board": a toggle that opens a search over all boards. Choosing one calls `onAdd`.
export function BoardPicker({
  available,
  busy,
  onAdd,
}: {
  available: BoardChoice[];
  /** True while a board is being loaded. */
  busy: boolean;
  onAdd: (boardId: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const pickerId = useId();

  const words = useMemo(() => wordsOf(query), [query]);
  const matching = useMemo(
    () => available.filter((b) => matchesWords(`${b.title}\n${b.description}`, words)),
    [available, words],
  );
  const shown = matching.slice(0, 8);

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          aria-controls={pickerId}
          className="link text-base"
        >
          {picking ? "Close" : "Add an existing board"}
        </button>
      </div>

      <div id={pickerId} className={picking ? "sketch-box flex flex-col gap-3 p-4" : "hidden"}>
        <input
          type="search"
          className="field text-lg"
          placeholder="Search titles and descriptions"
          aria-label="Search for a board to use"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {available.length === 0 ? (
          <p className="text-ink-muted">There are no other boards yet.</p>
        ) : matching.length === 0 ? (
          <p className="text-ink-muted">No board matches.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAdd(board.id)}
                  className="group flex w-full flex-col items-start gap-0.5 text-left"
                >
                  <span className="flex w-full items-baseline gap-3 text-lg">
                    <span className="text-accent">+</span>
                    <span className="min-w-0 flex-1 truncate group-hover:underline group-hover:decoration-wavy">
                      {board.title}
                    </span>
                    <span className="shrink-0 text-sm text-ink-faint">
                      {board.ownerName ? `by ${board.ownerName}` : "no owner"}
                    </span>
                  </span>
                  {board.description && (
                    <span className="line-clamp-1 pl-7 text-sm text-ink-muted">{board.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {matching.length > shown.length && (
          <p className="text-sm text-ink-muted">{matching.length - shown.length} more. Type to narrow the list.</p>
        )}
        {busy && <p className="text-ink-muted">Loading the board…</p>}
      </div>
    </>
  );
}
