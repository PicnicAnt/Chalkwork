"use client";

import { useEffect, useMemo, useState } from "react";
import { presetsOf } from "@/app/actions/boards";
import { matchesWords, wordsOf } from "@/lib/board-search";
import { SearchSelect } from "./ui/SearchSelect";

export type BoardType = {
  board: string;
  title: string;
  /** Its presets; when absent they are asked for. */
  presets?: string[];
};

const MAX_ROWS = 20;
// With this many boards or fewer there is no search box: they are all listed.
const SEARCH_FROM = 6;

// What a collection offers for adding boards: one "Add <board>" button per kind of board, with a searchable list of
// that board's presets next to it: picking a preset adds the board as that preset. It is the same on the board page and under "Try it" in the editor.
export function AddBoards({
  types,
  busy = false,
  onAdd,
}: {
  types: BoardType[];
  busy?: boolean;
  onAdd: (board: string, preset?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const words = useMemo(() => wordsOf(query), [query]);
  const shown = useMemo(() => types.filter((t) => matchesWords(t.title, words)), [types, words]);
  if (types.length === 0) return <p className="text-base text-ink-muted">There are no boards to add yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      {types.length >= SEARCH_FROM && (
        <input type="search" className="field text-lg" placeholder="Search boards" aria-label="Search boards to add" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
      )}
      {shown.length === 0 && <p className="text-base text-ink-muted">Nothing matches.</p>}
      <ul className="flex flex-col gap-2">
        {shown.slice(0, MAX_ROWS).map((t) => (
          <BoardTypeRow key={t.board} type={t} busy={busy} onAdd={onAdd} />
        ))}
      </ul>
      {shown.length > MAX_ROWS && <p className="text-sm text-ink-muted">{shown.length - MAX_ROWS} more. Type to narrow the list.</p>}
    </div>
  );
}

function BoardTypeRow({ type, busy, onAdd }: { type: BoardType; busy: boolean; onAdd: (board: string, preset?: string) => void }) {
  const [asked, setAsked] = useState<string[] | null>(null);
  useEffect(() => {
    if (type.presets) return;
    let cancelled = false;
    presetsOf(type.board).then((names) => {
      if (!cancelled) setAsked(names);
    });
    return () => {
      cancelled = true;
    };
  }, [type.board, type.presets]);
  const presets = type.presets ?? asked ?? [];
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <button type="button" className="btn" disabled={busy} onClick={() => onAdd(type.board)}>
        Add {type.title}
      </button>
      {presets.length > 0 && (
        // Picking a preset adds the board as that preset straight away.
        <SearchSelect
          value=""
          onChange={(p) => p && onAdd(type.board, p)}
          placeholder="Add as a preset"
          ariaLabel={`Preset of ${type.title} to add`}
          options={presets.map((p) => ({ value: p, label: p }))}
        />
      )}
    </li>
  );
}
