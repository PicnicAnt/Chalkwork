"use client";

import { useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";
import type { ExtraItem } from "@/lib/resolve-boards";

export type CollectionView = {
  name: string;
  title: string;
  /** The stats that are added up, or empty for every variable the items have. */
  stats: string[];
  /** Items the board's creator put in, which can't be taken out here. */
  fixed: { title: string }[];
  /** Items added by whoever is using the board. */
  added: { index: number; title: string }[];
  /** The boards that can be added, each followed by its presets; absent when adding needs a sign-in. */
  choices?: { board: string; preset?: string; title: string; boardTitle?: string }[];
};

// Where people using a board add existing boards to one of its collections. It sits inside the collection's own box.
// Boards are ticked from a searchable list, as many as wanted, and added together. Each board's variables are added up
// into the collection's totals, which the board's formulas use. The boards are kept in the address.
export function ItemControls({ collection: c, extras, onChange }: { collection: CollectionView; extras: ExtraItem[]; onChange: (extras: ExtraItem[]) => void }) {
  const [query, setQuery] = useState("");
  // The ticked choices, by their place in the list.
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const choices = useMemo(() => c.choices ?? [], [c.choices]);
  const words = useMemo(() => wordsOf(query), [query]);
  const shown = useMemo(
    () =>
      choices
        .map((ch, i) => ({ ch, i }))
        .filter(({ ch }) => matchesWords(ch.preset ? `${ch.boardTitle ?? ""} ${ch.preset}` : ch.title, words))
        .slice(0, 100),
    [choices, words],
  );
  const count = c.fixed.length + c.added.length;
  return (
    <div className="flex flex-col gap-2" aria-label={`Boards in ${c.title}`}>
      <p className="text-base text-ink-muted">
        Add boards here. Their variables are added up as {c.name}.&lt;variable&gt; (also avg(), min(), max() and count() in formulas), and each board has an Included switch (1 counts it, 0 leaves it out).
      </p>
      {count > 0 && (
        <ul className="flex flex-col gap-1 text-lg">
          {c.fixed.map((f, i) => (
            <li key={`f${i}`} className="text-ink-muted">
              {f.title}
            </li>
          ))}
          {c.added.map((a) => (
            <li key={a.index} className="flex items-baseline gap-3">
              <span>{a.title}</span>
              <button type="button" className="link text-base text-danger" aria-label={`Take ${a.title} out of ${c.title}`} onClick={() => onChange(extras.filter((_, i) => i !== a.index))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {c.choices === undefined ? (
        <p className="text-base text-ink-muted">Sign in to add boards.</p>
      ) : choices.length === 0 ? (
        <p className="text-base text-ink-muted">There are no boards to add yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="search"
            className="field text-lg"
            placeholder="Search boards"
            aria-label={`Search boards to add to ${c.title}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <ul className="flex max-h-64 flex-col overflow-y-auto" role="group" aria-label={`Boards that can be added to ${c.title}`}>
            {shown.length === 0 && <li className="px-2 py-1 text-base text-ink-muted">Nothing matches.</li>}
            {shown.map(({ ch, i }, n) => {
              const before = shown[n - 1]?.ch;
              // A preset whose board isn't just above it is given the board's name as a heading.
              const heading = ch.preset && !(before && (before.preset ? before.boardTitle === ch.boardTitle : before.title === ch.boardTitle));
              return (
                <li key={i}>
                  {heading && <p className="px-2 pt-1 text-base text-ink-muted">{ch.boardTitle}</p>}
                  <label className={`flex cursor-pointer items-center gap-3 py-1 pr-2 text-lg hover:bg-[var(--board-edge)] ${ch.preset ? "pl-8" : "pl-2"}`}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)]"
                      checked={ticked.has(i)}
                      onChange={(e) =>
                        setTicked((t) => {
                          const next = new Set(t);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 truncate">{ch.preset ?? ch.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-baseline gap-3">
            <button
              type="button"
              className="btn"
              disabled={ticked.size === 0}
              onClick={() => {
                const picked = [...ticked].sort((a, b) => a - b).flatMap((i) => (choices[i] ? [choices[i]] : []));
                onChange([...extras, ...picked.map((ch) => ({ group: c.name, board: ch.board, ...(ch.preset ? { preset: ch.preset } : {}) }))]);
                setTicked(new Set());
                setQuery("");
              }}
            >
              {ticked.size > 1 ? `Add ${ticked.size} boards` : "Add"}
            </button>
            {ticked.size > 0 && (
              <button type="button" className="link text-base" onClick={() => setTicked(new Set())}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
