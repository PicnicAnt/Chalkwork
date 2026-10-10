"use client";

import { BOARD_LIMITS, checkAlias, type Collection } from "@/lib/boards";
import { CollapsibleSection } from "./ui/CollapsibleSection";

/** A collection as it is typed: the stats are one line of text until they are read. */
export type CollectionDraft = { name: string; stats: string; boards: string[] };

export const collectionsOf = (drafts: readonly CollectionDraft[]): Collection[] =>
  drafts.flatMap((d) =>
    checkAlias(d.name.trim()) === null
      ? [{ name: d.name.trim(), stats: [...new Set(d.stats.split(/[\s,;]+/).filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)))], ...(d.boards.length ? { boards: d.boards } : {}) }]
      : [],
  );

// Collections of items: a name such as gear, and the stats to add up. People using the board can then add existing
// boards (a sword, a helm) to it, and formulas can use the totals as gear.strength.
export function CollectionsEditor({
  drafts,
  usedNames,
  available,
  onChange,
}: {
  drafts: CollectionDraft[];
  /** Names that are already taken by used boards. */
  usedNames: string[];
  /** The boards that can be allowed in a collection. */
  available: { id: string; title: string }[];
  onChange: (drafts: CollectionDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<CollectionDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <CollapsibleSection
      title="Item collections"
      count={drafts.length}
      description="A collection lets people using the board add existing boards to it as items, such as the items of a character. Give it a name (gear), list the stats to add up (strength, damage, armor), and choose which boards can be added (any, if none are chosen). Boards with presets, like a Sword with Longsword and Shortsword, let people pick a preset. Formulas can then use the totals as gear.strength, and each item gets an Equipped switch. Boards you use here can also be put in a collection from the Boards section."
    >
      <div className="flex flex-col gap-4">
        {drafts.map((d, i) => {
          const name = d.name.trim();
          const problem = name === "" ? null : checkAlias(name) ?? (usedNames.includes(name) ? "A used board already has this name" : drafts.some((o, j) => j < i && o.name.trim() === name) ? "Another collection has this name" : null);
          return (
            <div key={i} className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <input
                className={`field w-40 text-xl ${problem ? "!border-danger" : ""}`}
                value={d.name}
                maxLength={BOARD_LIMITS.alias}
                placeholder="gear"
                onChange={(e) => update(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Name of collection ${i + 1}`}
              />
              <input
                className="field min-w-[12rem] flex-1 text-xl"
                value={d.stats}
                placeholder="stats to add up: strength, damage, armor"
                onChange={(e) => update(i, { stats: e.target.value })}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Stats of ${d.name || `collection ${i + 1}`}`}
              />
              <button type="button" className="link text-base text-danger" onClick={() => onChange(drafts.filter((_, j) => j !== i))}>
                Remove
              </button>
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
                <select
                  value=""
                  className="max-w-[14rem] cursor-pointer bg-transparent text-lg"
                  aria-label={`Allow a board in ${d.name || `collection ${i + 1}`}`}
                  onChange={(e) => e.target.value && update(i, { boards: [...d.boards, e.target.value] })}
                >
                  <option value="">Allow a board…</option>
                  {available.filter((b) => !d.boards.includes(b.id)).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
              {problem && <span className="w-full text-sm text-danger">{problem}</span>}
            </div>
          );
        })}
        {drafts.length < 6 && (
          <div>
            <button type="button" className="btn" onClick={() => onChange([...drafts, { name: "", stats: "", boards: [] }])}>
              Add a collection
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
