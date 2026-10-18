"use client";

import { useState, useTransition } from "react";
import { findBestLoadout, type LoadoutFound } from "@/app/actions/loadout";
import type { Bundle } from "@/lib/boards";
import { displayName } from "@/lib/formulas";
import { MAX_COMBINATIONS } from "@/lib/loadout";
import type { ExtraItem } from "@/lib/resolve-boards";
import { localizeNumbers } from "@/lib/locale";
import { useNumberLocale } from "./useNumberLocale";
import { CollapsibleSection } from "./ui/CollapsibleSection";

// "Find the best loadout": for collections that list the boards they take, tries sets of those pieces (or their presets)
// and shows which sets make a chosen result highest or lowest. The best set can be put on the board with one tap.
export function LoadoutFinder({
  boardId,
  flat,
  groups,
  resultNames,
  values,
  locked,
  onApply,
}: {
  boardId: string;
  flat: Bundle;
  /** The collections whose boards are listed, with the number of pieces each has to choose from. */
  groups: { name: string; title: string; pieces: number }[];
  /** The variables the formulas work out, which are the ones that can be made best. */
  resultNames: string[];
  values: Record<string, string>;
  locked: string[];
  onApply: (items: ExtraItem[]) => void;
}) {
  const loc = useNumberLocale();
  // The results of the board itself (not those of the boards it brings along) can be made the best.
  const choices = Array.from(new Set([...Object.keys(flat.values), ...Object.keys(flat.labels)]))
    .filter((n) => resultNames.includes(n) && !n.includes("$") && !n.includes(".") && flat.hidden[n] !== true)
    .map((n) => ({ name: n, label: flat.labels[n] || displayName(n) }));
  const [goal, setGoal] = useState("");
  const [maximize, setMaximize] = useState(true);
  const [take, setTake] = useState<Record<string, number>>(() => Object.fromEntries(groups.map((g) => [g.name, 1])));
  const [message, setMessage] = useState<string | null>(null);
  const [found, setFound] = useState<{ tried: number; goalLabel: string; results: LoadoutFound[] } | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setMessage(null);
    setFound(null);
    start(async () => {
      const out = await findBestLoadout(boardId, { goal, maximize, take, values, locked });
      if (!out.ok) setMessage(out.error);
      else if (out.results.length === 0) setMessage("None of the sets could be worked out.");
      else setFound(out);
    });
  }

  const unit = flat.units[goal] ? ` ${flat.units[goal]}` : "";
  return (
    <CollapsibleSection
      title="Find the best loadout"
      description="Choose a result and how many pieces to take from each collection. Chalkwork tries every set of the pieces those collections list (with their presets) and shows the best ones."
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 text-lg">
        <label className="flex items-baseline gap-2">
          <span className="text-ink-muted">Make</span>
          <select value={goal} onChange={(e) => setGoal(e.target.value)} className="cursor-pointer bg-transparent text-lg" aria-label="Result to make the best">
            <option value="">choose a result…</option>
            {choices.map((c) => (
              <option key={c.name} value={c.name}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-baseline gap-2">
          <select value={maximize ? "high" : "low"} onChange={(e) => setMaximize(e.target.value === "high")} className="cursor-pointer bg-transparent text-lg" aria-label="Highest or lowest">
            <option value="high">as high as possible</option>
            <option value="low">as low as possible</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-lg">
        {groups.map((g) => (
          <label key={g.name} className="flex items-baseline gap-2">
            <span>{g.title}</span>
            <input
              type="number"
              min={0}
              max={Math.min(6, g.pieces)}
              value={take[g.name] ?? 0}
              onChange={(e) => setTake((t) => ({ ...t, [g.name]: Math.max(0, Math.min(6, Number(e.target.value) || 0)) }))}
              className="field w-14 text-center"
              aria-label={`How many from ${g.title}`}
            />
            <span className="text-base text-ink-faint">of {g.pieces}</span>
          </label>
        ))}
      </div>
      <div>
        <button type="button" className="btn" disabled={pending || !goal} onClick={run}>
          {pending ? "Trying the sets…" : "Find the best"}
        </button>
      </div>
      {message && <p className="text-danger">{message}</p>}
      {found && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-ink-muted">
            Tried {found.tried} {found.tried === 1 ? "set" : "sets"}; the best {found.results.length} by {found.goalLabel}. The pieces are added to what the board already has.
          </p>
          <ol className="flex flex-col gap-3">
            {found.results.map((r, i) => (
              <li key={i} className="sketch-box flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xl">
                    {localizeNumbers(r.shown, loc)}
                    {unit} {i === 0 && <span className="text-base text-accent">best</span>}
                  </div>
                  <div className="text-base text-ink-muted">{r.titles.join(", ")}</div>
                </div>
                <button type="button" className="link text-base" onClick={() => onApply(r.items)}>
                  Use this set
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-sm text-ink-faint">At most {MAX_COMBINATIONS} sets are tried, and a piece is used once. Values you have locked are kept.</p>
    </CollapsibleSection>
  );
}
