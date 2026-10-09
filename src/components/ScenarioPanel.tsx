"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteScenario, saveScenario } from "@/app/actions/scenarios";
import { difference, outcomeOf, SCENARIO_LIMITS, type Scenario, type ScenarioSnapshot } from "@/lib/scenarios";
import { displayName, formatDecimals, formatNumber, type Analysis } from "@/lib/formulas";
import { downloadCsv } from "@/lib/export";
import { encodeState } from "@/lib/share-state";
import { ratio as unitRatio } from "@/lib/units";
import { CollapsibleSection } from "./ui/CollapsibleSection";

// "both" is the value with its change in percent beside it, which is what is shown to begin with.
type View = "both" | "values" | "difference" | "percent";
const NOW = "now";

// Named sets of values for a board, kept by the person who made them. A scenario can be loaded back into the
// board, and any number can be put side by side with what the board shows now, as values, as the difference
// from a chosen baseline, or as a percentage of it. Values are written in the unit chosen for each variable
// on the board.
export function ScenarioPanel({
  boardId,
  analysis,
  scenarios,
  current,
  labels,
  units,
  hidden,
  decimals,
  shownUnits,
  onLoad,
}: {
  boardId: string;
  analysis: Analysis;
  scenarios: Scenario[];
  /** The values and locks on screen now. */
  current: ScenarioSnapshot;
  labels: Record<string, string>;
  units: Record<string, string>;
  hidden: Record<string, boolean>;
  decimals: Record<string, number>;
  /** The unit each variable is shown in on the board, where one was chosen. */
  shownUnits: Record<string, string>;
  onLoad: (scenario: Scenario) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [compared, setCompared] = useState<string[]>([]);
  const [view, setView] = useState<View>("both");
  const [baseline, setBaseline] = useState<string>(NOW);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const result = await saveScenario(boardId, name, current);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  // A link that opens the board with this scenario's numbers in place.
  async function copyLink(scenario: Scenario) {
    const link = `${location.origin}${location.pathname}?state=${encodeState(scenario)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(scenario.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this link:", link);
    }
  }

  function remove(id: string) {
    start(async () => {
      await deleteScenario(id);
      setCompared((c) => c.filter((x) => x !== id));
      router.refresh();
    });
  }

  const shownScenarios = scenarios.filter((s) => compared.includes(s.id));
  // The baseline has to be one of the columns; if it was unticked, it is the board as it is now.
  const baseKey = baseline === NOW || shownScenarios.some((s) => s.id === baseline) ? baseline : NOW;

  const columns = useMemo(
    () => [
      { key: NOW, title: "Now", outcome: outcomeOf(analysis, current, decimals) },
      ...shownScenarios.map((s) => ({ key: s.id, title: s.name, outcome: outcomeOf(analysis, s, decimals) })),
    ],
    [analysis, current, decimals, shownScenarios],
  );
  const base = columns.find((c) => c.key === baseKey) ?? columns[0];
  const rows = analysis.variables.filter((v) => hidden[v.name] !== true);

  // How a variable is shown: in the unit chosen on the board (a number written in its own unit is multiplied
  // by r), with the unit's label.
  const unitOf = (variable: string) => {
    const chosen = shownUnits[variable];
    const r = chosen ? unitRatio(units[variable], chosen) : null;
    return r === null ? { label: units[variable] ?? "", r: 1 } : { label: chosen, r };
  };

  // A value as written for a column, in the unit chosen for the variable.
  function valueText(variable: string, column: (typeof columns)[number]) {
    const { r } = unitOf(variable);
    const n = column.outcome.numbers[variable];
    if (r === 1 || n === undefined) return column.outcome.shown[variable] ?? "";
    const places = decimals[variable];
    return places !== undefined ? formatDecimals(n * r, places) : formatNumber(n * r);
  }

  // How far a column is from the baseline, as the numbers are written in the unit shown.
  function change(variable: string, column: (typeof columns)[number], as: "difference" | "percent") {
    const { r } = unitOf(variable);
    const value = column.outcome.numbers[variable];
    const from = base.outcome.numbers[variable];
    return difference(value === undefined ? undefined : value * r, from === undefined ? undefined : from * r, as, as === "difference" ? decimals[variable] : undefined);
  }

  const signClass = (sign: number) => (sign > 0 ? "text-accent-2" : sign < 0 ? "text-op" : "text-ink-faint");

  function cell(variable: string, column: (typeof columns)[number]): { text: string; className: string; note?: { text: string; className: string } } {
    const { r } = unitOf(variable);
    const places = decimals[variable];
    if (view === "both") {
      const text = valueText(variable, column) || "?";
      if (column.key === baseKey) return { text, className: "text-ink-muted" };
      const d = change(variable, column, "percent");
      return { text, className: "", note: d ? { text: d.text, className: signClass(d.sign) } : undefined };
    }
    if (view === "values") {
      const text = valueText(variable, column);
      return { text: text || "?", className: column.key !== NOW && text !== valueText(variable, columns[0]) ? "text-accent" : "" };
    }
    // The baseline shows its own value: it is what the others are measured from.
    if (column.key === baseKey) return { text: valueText(variable, column) || "?", className: "text-ink-muted" };
    const value = column.outcome.numbers[variable];
    const from = base.outcome.numbers[variable];
    const d = difference(value === undefined ? undefined : value * r, from === undefined ? undefined : from * r, view, view === "difference" ? places : undefined);
    if (!d) return { text: "–", className: "text-ink-faint" };
    return { text: d.text, className: signClass(d.sign) };
  }

  return (
    <CollapsibleSection
      title="Scenarios"
      count={scenarios.length}
      description="Keep the numbers you have typed as a named scenario (for example Build A and Build B), load one back whenever you like, and tick several to see them side by side. Scenarios are yours alone."
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className="field min-w-[12rem] flex-1 text-xl"
          value={name}
          maxLength={SCENARIO_LIMITS.name}
          placeholder="Name for what is on screen now"
          onChange={(e) => setName(e.target.value)}
          aria-label="Name of the scenario"
        />
        <button type="submit" disabled={pending || !name.trim()} className="btn">
          Save these values
        </button>
      </form>
      {error && <p className="text-danger">{error}</p>}

      {scenarios.length === 0 ? (
        <p className="text-ink-muted">You haven&apos;t saved a scenario on this board yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {scenarios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xl">
              <label className="flex min-w-0 flex-1 items-baseline gap-2">
                <input
                  type="checkbox"
                  checked={compared.includes(s.id)}
                  onChange={(e) => setCompared((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))}
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  aria-label={`Compare ${s.name}`}
                />
                <span className="truncate">{s.name}</span>
              </label>
              <button type="button" onClick={() => onLoad(s)} className="link text-base">
                Load
              </button>
              <button type="button" onClick={() => copyLink(s)} className="link text-base" aria-label={`Copy a link with ${s.name}`}>
                {copiedId === s.id ? "Copied ✓" : "Copy link"}
              </button>
              <button type="button" disabled={pending} onClick={() => remove(s.id)} className="link text-base text-danger" aria-label={`Delete ${s.name}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {shownScenarios.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-lg">
            <label className="flex items-baseline gap-2">
              <span className="text-ink-muted">Show</span>
              <select value={view} onChange={(e) => setView(e.target.value as View)} className="cursor-pointer bg-transparent text-lg" aria-label="How to show the scenarios">
                <option value="both">the values and the change in percent</option>
                <option value="values">the values</option>
                <option value="difference">the difference</option>
                <option value="percent">the difference in percent</option>
              </select>
            </label>
            {view !== "values" && (
              <label className="flex items-baseline gap-2">
                <span className="text-ink-muted">compared with</span>
                <select value={baseKey} onChange={(e) => setBaseline(e.target.value)} className="cursor-pointer bg-transparent text-lg" aria-label="What the differences are measured from">
                  <option value={NOW}>now</option>
                  {shownScenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="overflow-x-auto" aria-label="Scenarios side by side">
            <table className="w-full min-w-max border-collapse text-lg">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-1 pr-4 font-normal">Variable</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-3 py-1 font-normal">
                      {c.title}
                      {view !== "values" && c.key === baseKey && <span className="block text-sm text-ink-faint">baseline</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const unit = unitOf(v.name).label;
                  return (
                    <tr key={v.name} className="border-t border-ink-faint">
                      <td className="py-1 pr-4">
                        {labels[v.name] || displayName(v.name)}
                        {unit && <span className="text-ink-muted">{view === "percent" ? "" : ` (${unit})`}</span>}
                      </td>
                      {columns.map((c) => {
                        const { text, className, note } = cell(v.name, c);
                        return (
                          <td key={c.key} className={`px-3 py-1 ${className}`}>
                            {text}
                            {note && <span className={`ml-2 text-base ${note.className}`}>{note.text}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="pt-2 text-base text-ink-muted">
            <button
              type="button"
              className="link mr-3"
              onClick={() =>
                downloadCsv("scenarios.csv", [
                  ["Variable", "Unit", ...columns.map((c) => c.title)],
                  ...rows.map((v) => [labels[v.name] || displayName(v.name), unitOf(v.name).label, ...columns.map((c) => cell(v.name, c).text + (cell(v.name, c).note ? ` (${cell(v.name, c).note?.text})` : ""))]),
                ])
              }
            >
              Download CSV
            </button>
              {view === "values"
                ? "Numbers that differ from what the board shows now are coloured."
                : view === "both"
                  ? `Each value is followed by its change in percent from ${baseKey === NOW ? "what the board shows now" : `"${shownScenarios.find((s) => s.id === baseKey)?.name}"`}, which is the baseline column. Green is higher, orange is lower.`
                  : `Each number is the change from ${baseKey === NOW ? "what the board shows now" : `"${shownScenarios.find((s) => s.id === baseKey)?.name}"`}${view === "percent" ? ", as a percentage of it" : ""}. The baseline column shows its own values. Green is higher, orange is lower.`}
            </p>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
