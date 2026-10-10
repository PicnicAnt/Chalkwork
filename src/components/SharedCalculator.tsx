"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Bundle } from "@/lib/boards";
import { compute, initialLocks, shownValues } from "@/lib/calculator";
import { downloadCsv, fileNameOf } from "@/lib/export";
import { analyzeFormulas, displayName, formatNumber, parseValue } from "@/lib/formulas";
import type { Preset, Scenario, ScenarioSnapshot } from "@/lib/scenarios";
import { encodeState } from "@/lib/share-state";
import { encodeItems } from "@/lib/items-param";
import type { ExtraItem } from "@/lib/resolve-boards";
import { ItemControls, type CollectionView } from "./ItemPicker";
import { ShareMenu } from "./ShareMenu";
import { BoardGuide } from "./BoardGuide";
import { CalculatorPanel } from "./CalculatorView";
import { ConnectionsView } from "./ConnectionsView";
import { FormulaText } from "./FormulaText";
import { OptimizerPanel } from "./OptimizerPanel";
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
  collections = [],
  presets = [],
  boardChoices = [],
  extras = [],
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
  /** The collections of items of this board, and what is in them now. */
  collections?: CollectionView[];
  /** Scenarios the creator saved on the board. */
  presets?: Preset[];
  /** The boards that can be added as items. */
  boardChoices?: { id: string; title: string }[];
  /** The items someone using the board has added. */
  extras?: ExtraItem[];
}) {
  const router = useRouter();
  const analysis = useMemo(() => analyzeFormulas(flat.formulas, flat.tables), [flat.formulas, flat.tables]);
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
  // The unit each variable is shown in. Kept here so the scenarios are compared in the same units.
  const [shownUnits, setShownUnits] = useState<Record<string, string>>({});

  // The address of this board with the numbers on screen and these items.
  const linkWith = (items: ExtraItem[]) => {
    const params = new URLSearchParams({ state: encodeState({ values, locked: locks ?? initialLocks(analysis, values) }) });
    if (items.length > 0) params.set("items", encodeItems(items));
    return `${location.origin}${location.pathname}?${params}`;
  };

  // Puts a set of values and locks on the board, as if they had been typed.
  const load = (snapshot: ScenarioSnapshot) => {
    setValues(snapshot.values);
    setLocks(snapshot.locked);
    setLoadedLocks(snapshot.locked);
    setResets(resets + 1);
  };

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
        {view === "board" && publicId && (
          <ShareMenu
            boardId={publicId}
            inputs={analysis.variables
              .filter((v) => flat.hidden[v.name] !== true && parseValue(flat.values[v.name]) !== undefined)
              .slice(0, 2)
              .map((v) => ({ name: displayName(v.name), value: String(parseValue(flat.values[v.name])) }))}
            variables={analysis.variables.filter((v) => flat.hidden[v.name] !== true).map((v) => displayName(v.name))}
            valuesLink={() => linkWith(extras)}
            onDownloadCsv={() => {
              const out = compute(analysis, values, locks ?? initialLocks(analysis, values));
              const shown = shownValues(out.display, out.plan.held, flat.decimals);
              downloadCsv(`${fileNameOf(title)}.csv`, [
                ["Variable", "Name", "Value", "Unit"],
                ...analysis.variables.filter((v) => flat.hidden[v.name] !== true).map((v) => [flat.labels[v.name] || displayName(v.name), displayName(v.name), shown[v.name] ?? "", flat.units[v.name] ?? ""]),
              ]);
            }}
          />
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
      {view === "board" && presets.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2" role="group" aria-label="Presets">
          <span className="text-lg text-ink-muted">Presets</span>
          {presets.map((p) => (
            <button
              key={p.name}
              type="button"
              className="btn px-3 py-1 text-base"
              onClick={() => load({ values: { ...flat.values, ...p.values }, locked: p.locked })}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
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
          order={flat.order}
          types={flat.types}
          links={flat.links}
          groups={flat.groups}
          sectionExtras={Object.fromEntries(
            collections.map((c) => [
              c.name,
              <ItemControls
                key={c.name}
                collection={c}
                boards={boardChoices}
                extras={extras}
                onChange={(next) => {
                  const url = new URL(linkWith(next));
                  router.replace(`${url.pathname}${url.search}`);
                }}
              />,
            ]),
          )}
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
          onLoad={load}
        />
      )}
      {view === "board" && (
        <OptimizerPanel
          analysis={analysis}
          flat={flat}
          values={values}
          locked={locks ?? initialLocks(analysis, values)}
          boardId={boardId}
          onApply={load}
        />
      )}
      {view === "board" && flat.tables.length > 0 && (
        <section className="mt-4 flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Tables</h2>
          <div className="flex flex-wrap gap-4">
            {flat.tables.map((t) => (
              <figure key={t.name} className="sketch-box px-4 py-3 text-lg">
                <figcaption className="pb-1 text-ink-muted">
                  {displayName(t.name)}(x), {t.mode === "step" ? "step" : "linear"}
                </figcaption>
                <table className="border-collapse">
                  <tbody>
                    {t.rows.map(([x, y]) => (
                      <tr key={x}>
                        <td className="pr-4 text-right">{formatNumber(x)}</td>
                        <td className="text-accent-2">{formatNumber(y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            ))}
          </div>
        </section>
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
