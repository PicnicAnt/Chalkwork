"use client";

import { useMemo, useState } from "react";
import type { Bundle } from "@/lib/boards";
import { compute, initialLocks, shownValues } from "@/lib/calculator";
import { downloadCsv, fileNameOf } from "@/lib/export";
import { analyzeFormulas, displayName, parseValue } from "@/lib/formulas";
import type { Scenario, ScenarioSnapshot } from "@/lib/scenarios";
import { encodeState } from "@/lib/share-state";
import { ApiHint } from "./ApiHint";
import { BoardGuide } from "./BoardGuide";
import { CalculatorPanel } from "./CalculatorView";
import { ConnectionsView } from "./ConnectionsView";
import { FormulaText } from "./FormulaText";
import { ScenarioPanel } from "./ScenarioPanel";

// `flat` is the board together with the boards it uses, as one set of formulas and settings.
export function SharedCalculator({
  flat,
  formulas = [],
  editable,
  boardId,
  scenarios,
  initialState,
  title = "board",
  publicId,
}: {
  flat: Bundle;
  /** The board's own formulas as written, shown read-only below the variables. */
  formulas?: string[];
  /** Set when the signed-in user owns the board: the Connections view can then change its links. */
  editable?: { boardId: string; ownLinks: Record<string, string> };
  /** Set for a signed-in user: the board's id and the scenarios that user has saved on it. */
  boardId?: string;
  scenarios?: Scenario[];
  /** Values and locks to start with, from a link that carried them. */
  initialState?: ScenarioSnapshot;
  /** The board's title, for the name of a downloaded file. */
  title?: string;
  /** The board's id, to show how to use it from outside. */
  publicId?: string;
}) {
  const analysis = useMemo(() => analyzeFormulas(flat.formulas), [flat.formulas]);
  const [values, setValues] = useState(() => (initialState ? { ...flat.values, ...initialState.values } : flat.values));
  // Bumping the key remounts the panel, which also forgets the edit history.
  const [resets, setResets] = useState(0);
  // The strings view only makes sense for a board that uses other boards.
  const usesBoards = Object.keys(flat.groups).length > 0;
  const [view, setView] = useState<"board" | "strings">("board");
  // Which variables are locked, as far as an edit has told us; until then it is what the panel starts with.
  // A loaded scenario starts the panel over with its own locks.
  const [locks, setLocks] = useState<string[] | null>(initialState?.locked ?? null);
  const [loadedLocks, setLoadedLocks] = useState<string[] | undefined>(initialState?.locked);
  const [copied, setCopied] = useState(false);
  // The unit each variable is shown in. Kept here so the scenarios are compared in the same units.
  const [shownUnits, setShownUnits] = useState<Record<string, string>>({});

  return (
    <div className="flex flex-col gap-3">
      <BoardGuide />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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
        {view === "board" && (
          <button
            type="button"
            onClick={async () => {
              const link = `${location.origin}${location.pathname}?state=${encodeState({ values, locked: locks ?? initialLocks(analysis, values) })}`;
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                window.prompt("Copy this link:", link);
              }
            }}
            className="link text-base"
            title="A link that opens this board with the numbers you have typed"
          >
            {copied ? "Link copied ✓" : "Copy link with these values"}
          </button>
        )}
        {view === "board" && (
          <button
            type="button"
            className="link text-base"
            title="The values on screen as a spreadsheet file"
            onClick={() => {
              const out = compute(analysis, values, locks ?? initialLocks(analysis, values));
              const shown = shownValues(out.display, out.plan.held, flat.decimals);
              downloadCsv(`${fileNameOf(title)}.csv`, [
                ["Variable", "Name", "Value", "Unit"],
                ...analysis.variables.filter((v) => flat.hidden[v.name] !== true).map((v) => [flat.labels[v.name] || displayName(v.name), displayName(v.name), shown[v.name] ?? "", flat.units[v.name] ?? ""]),
              ]);
            }}
          >
            Download CSV
          </button>
        )}
        {!sameValues(values, flat.values) && view === "board" && (
          <button
            type="button"
            onClick={() => {
              setValues(flat.values);
              setLocks(null);
              setLoadedLocks(undefined);
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
          ranges={flat.ranges}
          links={flat.links}
          groups={flat.groups}
          visualizations={flat.visualizations}
          initialLocked={loadedLocks}
          onLocks={setLocks}
          shownUnits={shownUnits}
          onShownUnits={setShownUnits}
        />
      )}
      {view === "board" && boardId && scenarios && (
        <ScenarioPanel
          boardId={boardId}
          analysis={analysis}
          scenarios={scenarios}
          current={{ values, locked: locks ?? initialLocks(analysis, values) }}
          labels={flat.labels}
          units={flat.units}
          hidden={flat.hidden}
          decimals={flat.decimals}
          shownUnits={shownUnits}
          onLoad={(scenario) => {
            setValues(scenario.values);
            setLocks(scenario.locked);
            setLoadedLocks(scenario.locked);
            setResets(resets + 1);
          }}
        />
      )}
      {view === "board" && publicId && (
        <ApiHint
          boardId={publicId}
          inputs={analysis.variables
            .filter((v) => flat.hidden[v.name] !== true && parseValue(flat.values[v.name]) !== undefined)
            .slice(0, 2)
            .map((v) => ({ name: displayName(v.name), value: String(parseValue(flat.values[v.name])) }))}
          variables={analysis.variables.filter((v) => flat.hidden[v.name] !== true).map((v) => displayName(v.name))}
        />
      )}
      {view === "board" && formulas.length > 0 && (
        <section className="mt-6 flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Formulas</h2>
          <ul className="sketch-box flex flex-col gap-1 px-4 py-3 text-xl" aria-label="The formulas of this board, read only">
            {formulas.map((text, i) => (
              <li key={i} className="break-words">
                <FormulaText text={text} />
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
