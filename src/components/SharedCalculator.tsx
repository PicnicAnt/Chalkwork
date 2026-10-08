"use client";

import { useMemo, useState } from "react";
import type { Bundle } from "@/lib/boards";
import { analyzeFormulas } from "@/lib/formulas";
import { CalculatorPanel } from "./CalculatorView";
import { ConnectionsView } from "./ConnectionsView";

// `flat` is the board together with the boards it uses, as one set of formulas and settings.
export function SharedCalculator({
  flat,
  equations = [],
  editable,
}: {
  flat: Bundle;
  /** The board's own formulas as written, shown read-only below the variables. */
  equations?: string[];
  /** Set when the signed-in user owns the board: the Connections view can then change its links. */
  editable?: { boardId: string; ownLinks: Record<string, string> };
}) {
  const analysis = useMemo(() => analyzeFormulas(flat.formulas), [flat.formulas]);
  const [values, setValues] = useState(flat.values);
  // Bumping the key remounts the panel, which also forgets the edit history.
  const [resets, setResets] = useState(0);
  // The strings view only makes sense for a board that uses other boards.
  const usesBoards = Object.keys(flat.groups).length > 0;
  const [view, setView] = useState<"board" | "strings">("board");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        {usesBoards ? (
          <div className="flex gap-4 text-lg" role="tablist" aria-label="View">
            {(
              [
                ["board", "Board"],
                ["strings", "Connections"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={view === id ? "text-accent underline decoration-wavy underline-offset-4" : "link"}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {!sameValues(values, flat.values) && view === "board" && (
          <button
            type="button"
            onClick={() => {
              setValues(flat.values);
              setResets(resets + 1);
            }}
            className="link text-base"
          >
            Erase and start over
          </button>
        )}
      </div>
      {view === "strings" && usesBoards ? (
        <ConnectionsView analysis={analysis} flat={flat} editable={editable} />
      ) : (
        <CalculatorPanel
          key={resets}
          analysis={analysis}
          values={values}
          onChange={setValues}
          descriptions={flat.descriptions}
          units={flat.units}
          labels={flat.labels}
          hidden={flat.hidden}
          decimals={flat.decimals}
          links={flat.links}
          groups={flat.groups}
        />
      )}
      {view === "board" && equations.length > 0 && (
        <section className="mt-6 flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Equations</h2>
          <ul className="sketch-box flex flex-col gap-1 px-4 py-3 text-xl text-accent-2" aria-label="The equations of this board, read only">
            {equations.map((text, i) => (
              <li key={i} className="break-words">
                {text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// The page is reloaded after links change, which hands over a new copy of the same values.
const sameValues = (a: Record<string, string>, b: Record<string, string>) => JSON.stringify(a) === JSON.stringify(b);
