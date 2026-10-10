"use client";

import { useEffect, useState } from "react";
import { variablesOf } from "@/app/actions/boards";
import { BOARD_LIMITS, checkAlias, type Collection } from "@/lib/boards";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { ListTypeahead } from "./ui/ListTypeahead";
import { SearchSelect } from "./ui/SearchSelect";

/** A collection as it is typed: the stats are one line of text until they are read. */
export type CollectionDraft = { name: string; stats: string; boards: string[] };

export const collectionsOf = (drafts: readonly CollectionDraft[]): Collection[] =>
  drafts.flatMap((d) =>
    checkAlias(d.name.trim()) === null
      ? [{ name: d.name.trim(), stats: [...new Set(d.stats.split(/[\s,;]+/).filter((s) => /^[A-Za-z_][A-Za-z0-9_]*(:(sum|avg|min|max))?$/.test(s)))], ...(d.boards.length ? { boards: d.boards } : {}) }]
      : [],
  );

// Collections of items: a name such as gear, and the stats to add up. People using the board can then add existing
// boards (a sword, a helm) to it, and formulas can use the totals as gear.strength.
export function CollectionsEditor({
  drafts,
  usedNames,
  usedVariables,
  available,
  onChange,
}: {
  drafts: CollectionDraft[];
  /** Names that are already taken by used boards. */
  usedNames: string[];
  /** Variables of the boards this board uses, suggested when no boards are listed. */
  usedVariables: string[];
  /** The boards that can be allowed in a collection. */
  available: { id: string; title: string }[];
  onChange: (drafts: CollectionDraft[]) => void;
}) {
  // The variables of the boards that can be added, for the typeahead (looked up when the list of boards changes).
  const [known, setKnown] = useState<Record<string, string[]>>({});
  const keys = drafts.map((d) => d.boards.join(",")).join("|");
  useEffect(() => {
    let cancelled = false;
    for (const key of new Set(keys.split("|").filter(Boolean))) {
      variablesOf(key.split(",")).then((names) => {
        if (!cancelled) setKnown((k) => ({ ...k, [key]: names }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [keys]);
  const suggestionsFor = (d: CollectionDraft) => (d.boards.length ? (known[d.boards.join(",")] ?? []) : usedVariables);
  const update = (i: number, patch: Partial<CollectionDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <CollapsibleSection
      title="Collections"
      count={drafts.length}
      description="A collection lets people using the board add existing boards to it, and adds up the variables you choose across them. Give it a name (parts), list the variables to add up (weight, cost), and choose which boards can be added (any, if none are chosen). A board with presets lets people pick a preset when adding it. Formulas can then use the totals as parts.weight, and each added board gets an Included switch (1 counts it, 0 leaves it out). A variable is added up unless you write :avg, :min or :max after it (damage:avg). Formulas can also ask for avg(parts.damage), min(...), max(...), sum(...) or count(parts). Boards you use here can also be put in a collection from the Boards section."
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
                placeholder="parts"
                onChange={(e) => update(i, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`Name of collection ${i + 1}`}
              />
              <ListTypeahead
                className="min-w-[12rem] flex-1"
                value={d.stats}
                onChange={(stats) => update(i, { stats })}
                suggestions={suggestionsFor(d)}
                placeholder="variables: weight, cost, damage:avg"
                ariaLabel={`Variables ${d.name || `collection ${i + 1}`} adds up`}
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
                <SearchSelect
                  value=""
                  onChange={(id) => id && update(i, { boards: [...d.boards, id] })}
                  placeholder="Allow a board…"
                  ariaLabel={`Allow a board in ${d.name || `collection ${i + 1}`}`}
                  options={available.filter((b) => !d.boards.includes(b.id)).map((b) => ({ value: b.id, label: b.title }))}
                />
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
