"use client";

import { useEffect, useState } from "react";
import { presetsOf } from "@/app/actions/boards";
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
  /** When the creator listed the boards that can be added: each one, and each of its presets, as a choice. */
  choices?: { board: string; preset?: string; title: string }[];
};

// Where people using a board add existing boards to its collections (items of a character, say). Each item's stats
// are added up into the collection's totals, which the board's formulas use. The items are kept in the address.
export function ItemPicker({
  collections,
  boards,
  extras,
  onChange,
}: {
  collections: CollectionView[];
  /** The boards that can be added. */
  boards: { id: string; title: string }[];
  extras: ExtraItem[];
  onChange: (extras: ExtraItem[]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {collections.map((c) => (
        <Collection key={c.name} collection={c} boards={boards} extras={extras} onChange={onChange} />
      ))}
    </div>
  );
}

function Collection({ collection: c, boards, extras, onChange }: { collection: CollectionView; boards: { id: string; title: string }[]; extras: ExtraItem[]; onChange: (extras: ExtraItem[]) => void }) {
  const [pick, setPick] = useState("");
  // The presets of the chosen board (a Shortsword, a Bow), so an item can be added as one of them.
  const [presets, setPresets] = useState<{ board: string; names: string[] } | null>(null);
  const [preset, setPreset] = useState("");
  useEffect(() => {
    if (!pick) return;
    let cancelled = false;
    presetsOf(pick).then((names) => {
      if (!cancelled) setPresets({ board: pick, names });
    });
    return () => {
      cancelled = true;
    };
  }, [pick]);
  const names = presets?.board === pick ? presets.names : [];
  const count = c.fixed.length + c.added.length;
  return (
    <section className="sketch-box flex flex-col gap-2 px-4 py-3" aria-label={`Items of ${c.title}`}>
      <h2 className="text-xl">
        {c.title} <span className="text-base text-ink-muted">({count} {count === 1 ? "item" : "items"})</span>
      </h2>
      <p className="text-base text-ink-muted">
        Add boards as items: {c.stats.length > 0 ? c.stats.join(", ") : "their variables"} are added up into {c.name}.&lt;stat&gt;, and each item has an Equipped switch (1 counts it, 0 leaves it out).
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
      {c.choices && c.choices.length > 0 ? (
        <div className="flex flex-wrap items-baseline gap-3">
          <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-w-0 max-w-full cursor-pointer bg-transparent text-lg" aria-label={`Item to add to ${c.title}`}>
            <option value="">Choose an item…</option>
            {c.choices.map((ch, i) => (
              <option key={i} value={String(i)}>
                {ch.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={pick === ""}
            onClick={() => {
              const ch = c.choices![Number(pick)];
              if (ch) onChange([...extras, { group: c.name, board: ch.board, ...(ch.preset ? { preset: ch.preset } : {}) }]);
              setPick("");
            }}
          >
            Add item
          </button>
        </div>
      ) : boards.length > 0 ? (
        <div className="flex flex-wrap items-baseline gap-3">
          <select
            value={pick}
            onChange={(e) => {
              setPick(e.target.value);
              setPreset("");
            }} className="min-w-0 max-w-full cursor-pointer bg-transparent text-lg" aria-label={`Board to add to ${c.title}`}>
            <option value="">Choose a board…</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          {names.length > 0 && (
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="cursor-pointer bg-transparent text-lg" aria-label="Preset to start from">
              <option value="">as it is</option>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn"
            disabled={!pick}
            onClick={() => {
              onChange([...extras, { group: c.name, board: pick, ...(preset ? { preset } : {}) }]);
              setPick("");
              setPreset("");
            }}
          >
            Add item
          </button>
        </div>
      ) : (
        <p className="text-base text-ink-muted">Sign in to add items.</p>
      )}
    </section>
  );
}
