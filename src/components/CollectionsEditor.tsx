"use client";

import { BOARD_LIMITS, checkAlias, type Collection } from "@/lib/boards";
import { Foldable } from "./ui/Foldable";
import { SearchSelect } from "./ui/SearchSelect";

/** A collection as it is typed. */
export type CollectionDraft = { name: string; boards: string[] };

export const collectionsOf = (drafts: readonly CollectionDraft[]): Collection[] =>
  drafts.flatMap((d) =>
    checkAlias(d.name.trim()) === null ? [{ name: d.name.trim(), stats: [], ...(d.boards.length ? { boards: d.boards } : {}) }] : [],
  );

// The variables of the type collection: a name such as parts, and which boards can be added to it. People using the
// board add existing boards, and formulas use what they add up to: parts.weight, avg(parts.weight), count(parts).
// Shown as rows of the variable list.
export function collectionItems({
  drafts,
  usedNames,
  available,
  onChange,
  isOpen,
  onToggle,
}: {
  drafts: CollectionDraft[];
  /** Names that are already taken by used boards. */
  usedNames: string[];
  /** The boards that can be allowed in a collection. */
  available: { id: string; title: string }[];
  onChange: (drafts: CollectionDraft[]) => void;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
}) {
  const update = (i: number, patch: Partial<CollectionDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return drafts.map((d, i) => {
        const name = d.name.trim();
        const problem = name === "" ? null : checkAlias(name) ?? (usedNames.includes(name) ? "A used board already has this name" : drafts.some((o, j) => j < i && o.name.trim() === name) ? "Another collection has this name" : null);
        return {
          id: name || `new:collection:${i}`,
          render: (handle?: React.ReactNode) => (
          <Foldable
            key={i}
            handle={handle}
            expanded={isOpen(`collection:${i}`)}
            onToggle={() => onToggle(`collection:${i}`)}
            summary={d.name || "New collection"}
            hint={` · collection${d.boards.length ? `, ${d.boards.length} ${d.boards.length === 1 ? "board" : "boards"} allowed` : ", any board"}`}
          >
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <input
                className={`field w-40 text-xl ${problem ? "!border-danger" : ""}`}
                value={d.name}
                maxLength={BOARD_LIMITS.alias}
                placeholder="parts"
                onChange={(e) => update(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Name of collection ${i + 1}`}
              />
              <button type="button" className="link text-base text-danger" onClick={() => onChange(drafts.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
            <p className="text-base text-ink-muted">
              People using the board add existing boards to it. Formulas use {d.name || "parts"}.weight (the total of weight over the boards in it), avg({d.name || "parts"}.weight), min(...), max(...), sum(...)
              and count({d.name || "parts"}). Each added board gets an Included switch.
            </p>
            <div className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-lg text-ink-muted">
              <span>boards that can be added:</span>
              {d.boards.length === 0 && <span>any board</span>}
              {d.boards.map((id) => (
                <span key={id} className="flex items-baseline gap-1 text-ink">
                  {available.find((b) => b.id === id)?.title ?? "A board"}
                  <button type="button" className="link text-sm text-danger" aria-label={`Don't allow this board in ${d.name || "the collection"}`} onClick={() => update(i, { boards: d.boards.filter((b) => b !== id) })}>
                    ×
                  </button>
                </span>
              ))}
              <SearchSelect
                value=""
                onChange={(id) => id && update(i, { boards: [...d.boards, id] })}
                placeholder="Allow a board…"
                ariaLabel={`Allow a board in ${d.name || `collection ${i + 1}`}`}
                options={available.filter((b) => !d.boards.includes(b.id)).map((b) => ({ value: b.id, label: b.title }))}
              />
            </div>
            {problem && <span className="text-sm text-danger">{problem}</span>}
          </Foldable>
          ),
        };
  });
}
