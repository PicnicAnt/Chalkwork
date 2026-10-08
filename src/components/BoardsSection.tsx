"use client";

import { useId, useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";
import { BOARD_LIMITS, checkAlias, type Include, type IncludedBundle } from "@/lib/boards";

export type BoardChoice = { id: string; title: string; description: string; ownerName: string | null };

// The boards this board uses. "Add an existing board" opens a search of all boards; the chosen one
// goes by an alias, and its variables join this board as alias.name, ready to be used in formulas
// and to be linked with variables of this board or of other boards in use.
export function BoardsSection({
  includes,
  included,
  available,
  busy,
  error,
  onAdd,
  onAlias,
  onName,
  onRemove,
}: {
  includes: Include[];
  included: IncludedBundle[];
  available: BoardChoice[];
  /** True while a board is being loaded. */
  busy: boolean;
  /** Why the last board couldn't be added, if it couldn't. */
  error: string | null;
  onAdd: (boardId: string) => void;
  onAlias: (from: string, to: string) => void;
  onName: (alias: string, name: string) => void;
  onRemove: (alias: string) => void;
}) {
  // Folded away by default; the fields stay mounted while folded so nothing typed is lost.
  const [open, setOpen] = useState(false);
  const bodyId = useId();
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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">
          Boards used <span className="text-lg font-normal text-ink-muted">({includes.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="link text-base"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      <div id={bodyId} className={open ? "flex flex-col gap-3" : "hidden"}>
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
      <p className="text-base text-ink-muted">
        Another board&apos;s variables can be added to this one. They appear as <em>name.variable</em>, and you can use
        them in formulas and link them with your own variables or with those of other boards, for example{" "}
        <span className="text-accent-2">weapon.damage = my_damage</span>. Linked variables follow each other either way.
      </p>

      {error && <p className="text-danger">{error}</p>}

      {includes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {includes.map((inc) => {
            const loaded = included.find((i) => i.alias === inc.alias);
            return (
              <UsedBoard
                key={inc.alias}
                inc={inc}
                title={loaded?.title ?? "Board"}
                otherAliases={includes.filter((i) => i.alias !== inc.alias).map((i) => i.alias)}
                onAlias={(to) => onAlias(inc.alias, to)}
                onName={(name) => onName(inc.alias, name)}
                onRemove={() => onRemove(inc.alias)}
              />
            );
          })}
        </ul>
      )}

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
      </div>
    </section>
  );
}

function UsedBoard({
  inc,
  title,
  otherAliases,
  onAlias,
  onName,
  onRemove,
}: {
  inc: Include;
  title: string;
  otherAliases: string[];
  onAlias: (to: string) => void;
  onName: (name: string) => void;
  onRemove: () => void;
}) {
  // The alias is applied when the field is left or Enter is pressed, so half-typed names never
  // rewrite the formulas.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    if (next === inc.alias) {
      setDraft(null);
      setError(null);
      return;
    }
    const problem = checkAlias(next) ?? (otherAliases.includes(next) ? `"${next}" is already used for another board` : null);
    if (problem) {
      setError(problem);
      return;
    }
    onAlias(next);
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <a
          href={`/c/${inc.board}`}
          target="_blank"
          rel="noopener"
          className="link min-w-0 flex-1 basis-40 truncate text-xl"
          title="Open this board in a new tab"
        >
          {title}
        </a>
        <input
          className="field w-48 text-lg"
          value={inc.name ?? ""}
          maxLength={BOARD_LIMITS.name}
          placeholder="Name on the board"
          onChange={(e) => onName(e.target.value)}
          aria-label={`Name shown for ${title}`}
          title="What this board is called here, for example Player or Enemy"
        />
        <label className="flex items-baseline gap-2 text-lg text-ink-muted">
          used as
          <input
            className={`field w-40 text-xl text-ink ${error ? "!border-danger" : ""}`}
            value={draft ?? inc.alias}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(null);
                setError(null);
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={`Name used for ${title}`}
          />
        </label>
        <button type="button" onClick={onRemove} className="link text-base" aria-label={`Stop using ${title}`}>
          Remove
        </button>
      </div>
      {error && <span className="text-sm text-danger">{error}</span>}
    </li>
  );
}