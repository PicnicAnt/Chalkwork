"use client";

import { useEffect, useState } from "react";
import { presetsOf } from "@/app/actions/boards";
import { SearchSelect } from "./ui/SearchSelect";

// In the editor's "Try it" section: boards added to a collection to see how it works out. They are only for trying
// and aren't saved; people using the board add their own the same way.
export function TryItems({
  collection,
  boards,
  items,
  busy,
  onAdd,
  onRemove,
}: {
  collection: string;
  /** The boards that can be added: the ones the collection lists, or every board. */
  boards: { id: string; title: string }[];
  items: { alias: string; title: string }[];
  busy: boolean;
  onAdd: (boardId: string, preset?: string) => void;
  onRemove: (alias: string) => void;
}) {
  const [pick, setPick] = useState("");
  // The presets of the chosen board, so it can be tried as one of them.
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
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base text-ink-muted">
        Try it: add boards here to see the totals. People using the board add their own the same way; these aren&apos;t saved.
      </p>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1 text-lg">
          {items.map((i) => (
            <li key={i.alias} className="flex items-baseline gap-3">
              <span>{i.title}</span>
              <button type="button" className="link text-base text-danger" aria-label={`Take ${i.title} out of ${collection}`} onClick={() => onRemove(i.alias)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {boards.length > 0 ? (
        <div className="flex flex-wrap items-baseline gap-3">
          <SearchSelect value={pick} onChange={(id) => { setPick(id); setPreset(""); }} placeholder="Choose a board…" ariaLabel={`Board to try in ${collection}`} options={boards.map((b) => ({ value: b.id, label: b.title }))} />
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
            disabled={!pick || busy}
            onClick={() => {
              onAdd(pick, preset || undefined);
              setPick("");
              setPreset("");
            }}
          >
            Add
          </button>
        </div>
      ) : (
        <p className="text-base text-ink-muted">There are no boards to add yet.</p>
      )}
    </div>
  );
}
