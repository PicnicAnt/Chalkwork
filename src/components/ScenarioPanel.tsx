"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteScenario, saveScenario } from "@/app/actions/scenarios";
import { resultsOf, SCENARIO_LIMITS, type Scenario, type ScenarioSnapshot } from "@/lib/scenarios";
import { displayName, type Analysis } from "@/lib/formulas";
import { CollapsibleSection } from "./ui/CollapsibleSection";

// Named sets of values for a board, kept by the person who made them. A scenario can be loaded back into the
// board, and any number can be put side by side with what the board shows now.
export function ScenarioPanel({
  boardId,
  analysis,
  scenarios,
  current,
  labels,
  units,
  hidden,
  decimals,
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
  onLoad: (scenario: Scenario) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [compared, setCompared] = useState<string[]>([]);

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

  function remove(id: string) {
    start(async () => {
      await deleteScenario(id);
      setCompared((c) => c.filter((x) => x !== id));
      router.refresh();
    });
  }

  const shownScenarios = scenarios.filter((s) => compared.includes(s.id));
  const columns = useMemo(
    () => [
      { key: "now", title: "Now", results: resultsOf(analysis, current, decimals) },
      ...shownScenarios.map((s) => ({ key: s.id, title: s.name, results: resultsOf(analysis, s, decimals) })),
    ],
    [analysis, current, decimals, shownScenarios],
  );
  const rows = analysis.variables.filter((v) => hidden[v.name] !== true);

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
              <button type="button" disabled={pending} onClick={() => remove(s.id)} className="link text-base text-danger" aria-label={`Delete ${s.name}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {shownScenarios.length > 0 && (
        <div className="overflow-x-auto" aria-label="Scenarios side by side">
          <table className="w-full min-w-max border-collapse text-lg">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="py-1 pr-4 font-normal">Variable</th>
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-1 font-normal">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const now = columns[0].results[v.name];
                return (
                  <tr key={v.name} className="border-t border-ink-faint">
                    <td className="py-1 pr-4">
                      {labels[v.name] || displayName(v.name)}
                      {units[v.name] && <span className="text-ink-muted"> ({units[v.name]})</span>}
                    </td>
                    {columns.map((c, i) => {
                      const value = c.results[v.name] ?? "";
                      const differs = i > 0 && value !== now;
                      return (
                        <td key={c.key} className={`px-3 py-1 ${differs ? "text-accent" : ""}`} title={differs ? `Now: ${now}` : undefined}>
                          {value || "?"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pt-2 text-base text-ink-muted">Numbers that differ from what the board shows now are coloured.</p>
        </div>
      )}
    </CollapsibleSection>
  );
}
