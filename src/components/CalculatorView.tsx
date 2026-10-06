"use client";

import { useMemo, useState } from "react";
import {
  evaluateFormulas,
  formatForInput,
  inputsBehind,
  parseInputValue,
  solveForInput,
  type Analysis,
} from "@/lib/formulas";

const fieldClass =
  "w-full rounded-md border bg-white px-3 py-2 font-mono text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-white/5";

// Every variable is editable. Editing an input recalculates the results; editing a result
// works backwards and adjusts one of the inputs behind it so the result matches.
export function CalculatorPanel({
  analysis,
  values,
  onChange,
  onReset,
}: {
  analysis: Analysis;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onReset?: () => void;
}) {
  const results = useMemo(() => evaluateFormulas(analysis, values), [analysis, values]);
  // The result field being typed into keeps the user's text instead of the computed value.
  const [editing, setEditing] = useState<{ name: string; text: string } | null>(null);
  // Inputs the user has typed into, most recent last. Results adjust the least recent one.
  const [touched, setTouched] = useState<string[]>([]);
  // Which input each result should adjust, when the user picked one.
  const [solveChoice, setSolveChoice] = useState<Record<string, string>>({});
  const [adjusted, setAdjusted] = useState<string | null>(null);
  const [solveError, setSolveError] = useState<{ name: string; message: string } | null>(null);

  const filled = (name: string) => parseInputValue(values[name]) !== undefined;

  function pickUnknown(result: string, candidates: string[]): string {
    const chosen = solveChoice[result];
    if (chosen && candidates.includes(chosen)) return chosen;
    const missing = candidates.filter((c) => !filled(c));
    if (missing.length) return missing[0];
    const untouched = candidates.find((c) => !touched.includes(c));
    return untouched ?? [...candidates].sort((a, b) => touched.indexOf(a) - touched.indexOf(b))[0];
  }

  function editInput(name: string, text: string) {
    setTouched([...touched.filter((t) => t !== name), name]);
    setAdjusted(null);
    setSolveError(null);
    onChange({ ...values, [name]: text });
  }

  function editResult(name: string, text: string, unknownOverride?: string) {
    setEditing({ name, text });
    setAdjusted(null);
    setSolveError(null);
    const goal = parseInputValue(text);
    if (goal === undefined) return;
    if (typeof goal !== "number") return setSolveError({ name, message: "Enter a number" });

    const candidates = inputsBehind(analysis, name);
    if (candidates.length === 0) return setSolveError({ name, message: "Doesn't depend on any input" });
    const unknown = unknownOverride ?? pickUnknown(name, candidates);
    const stillMissing = candidates.filter((c) => c !== unknown && !filled(c));
    if (stillMissing.length) return setSolveError({ name, message: `Fill in ${stillMissing.join(", ")} first` });

    const x = solveForInput(analysis, values, name, goal, unknown);
    if (x === null) {
      const label = analysis.inputs.find((i) => i.name === unknown)?.label ?? unknown;
      return setSolveError({ name, message: `No value of ${label} gives this result` });
    }
    setAdjusted(unknown);
    onChange({ ...values, [unknown]: formatForInput(x) });
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Inputs</h2>
          {onReset && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setAdjusted(null);
                setSolveError(null);
                onReset();
              }}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset
            </button>
          )}
        </div>
        {analysis.inputs.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">
            No inputs. Any name a formula uses but doesn&apos;t define shows up here.
          </p>
        )}
        {analysis.inputs.map((input) => (
          <label key={input.name} className="flex flex-col gap-1 text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-medium">
                {input.label}
                {adjusted === input.name && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    adjusted
                  </span>
                )}
              </span>
              <code className="font-mono text-xs text-black/40 dark:text-white/40">{input.name}</code>
            </span>
            <input
              className={`${fieldClass} ${adjusted === input.name ? "border-amber-400" : "border-black/15 dark:border-white/15"}`}
              inputMode="decimal"
              placeholder="Enter a value"
              value={values[input.name] ?? ""}
              onChange={(e) => editInput(input.name, e.target.value)}
            />
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Results</h2>
        {results.length === 0 && <p className="text-sm text-black/50 dark:text-white/50">No formulas yet.</p>}
        {results.map((result, i) => {
          const formula = analysis.formulas[i];
          const isEditing = editing?.name === result.name;
          const candidates = formula.error ? [] : inputsBehind(analysis, result.name);
          const unknown = candidates.length ? pickUnknown(result.name, candidates) : null;
          const problem = solveError?.name === result.name ? solveError.message : isEditing ? null : result.error;
          const editable = !formula.error && candidates.length > 0;

          return (
            <div key={i} className="flex flex-col gap-1 text-sm">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{result.label}</span>
                <code className="truncate font-mono text-xs text-black/40 dark:text-white/40">{result.text}</code>
              </span>
              <input
                className={`${fieldClass} border-black/15 bg-black/[0.03] font-semibold dark:border-white/15`}
                inputMode="decimal"
                readOnly={!editable}
                placeholder={result.missing ? "—" : ""}
                value={isEditing ? editing.text : (result.value ?? "")}
                onChange={(e) => editResult(result.name, e.target.value)}
                onBlur={() => setEditing(null)}
                aria-label={result.label}
              />
              <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs">
                <span
                  className={
                    problem
                      ? result.missing && !solveError
                        ? "text-black/40 dark:text-white/40"
                        : "text-red-600 dark:text-red-400"
                      : ""
                  }
                >
                  {problem}
                </span>
                {editable && unknown && candidates.length > 1 && (
                  <label className="flex items-center gap-1 text-black/50 dark:text-white/50">
                    Editing adjusts
                    <select
                      className="rounded border border-black/15 bg-transparent px-1 py-0.5 font-mono dark:border-white/15"
                      value={unknown}
                      onChange={(e) => {
                        setSolveChoice({ ...solveChoice, [result.name]: e.target.value });
                        if (isEditing) editResult(result.name, editing.text, e.target.value);
                      }}
                    >
                      {candidates.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {editable && unknown && candidates.length === 1 && (
                  <span className="text-black/40 dark:text-white/40">
                    Editing adjusts <code className="font-mono">{unknown}</code>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
