"use client";

import { useMemo, useState } from "react";
import { brokenFormulas, formatNumber, parseValue, planSolve, solve, type Analysis } from "@/lib/formulas";

function compute(analysis: Analysis, values: Record<string, string>, recent: string[]) {
  const plan = planSolve(analysis, recent);
  const numbers = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseValue(v)]));
  const result = solve(analysis, plan, numbers, numbers);
  // Values the user is holding keep their exact text; everything else shows the calculated number.
  const display: Record<string, string> = {};
  for (const v of analysis.variables) {
    display[v.name] = plan.held.includes(v.name) ? (values[v.name] ?? "") : formatNumber(result.values[v.name]);
  }
  return { plan, result, display, broken: brokenFormulas(analysis, plan, result.values) };
}

// One list of variables, all editable. Editing one keeps it and the other most recently
// edited values fixed, and recalculates every other variable so all formulas still hold.
export function CalculatorPanel({
  analysis,
  values,
  onChange,
}: {
  analysis: Analysis;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const [recent, setRecent] = useState<string[]>([]);
  const [changed, setChanged] = useState<string[]>([]);
  const { plan, result, display, broken } = useMemo(
    () => compute(analysis, values, recent),
    [analysis, values, recent],
  );

  function edit(name: string, text: string) {
    const nextRecent = [name, ...recent.filter((r) => r !== name)];
    const nextValues = { ...display, [name]: text };
    const next = compute(analysis, nextValues, nextRecent);
    setChanged(analysis.variables.map((v) => v.name).filter((n) => n !== name && next.display[n] !== display[n]));
    setRecent(nextRecent);
    // Store calculated values too, so the next edit starts from what's on screen.
    onChange({ ...next.display, [name]: text });
  }

  const lastEdited = recent[0];

  if (analysis.variables.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">Variables from your formulas show up here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {analysis.variables.map((v) => {
          const fixedByFormula = v.name === lastEdited && !plan.held.includes(v.name);
          const failed = result.failed && v.name === lastEdited;
          const highlight = changed.includes(v.name);
          return (
            <label key={v.name} className="flex flex-col gap-1 text-sm">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{v.label}</span>
                <code className="font-mono text-xs text-black/40 dark:text-white/40">{v.name}</code>
              </span>
              <input
                className={`w-full rounded-md border bg-white px-3 py-2 font-mono text-base outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-white/5 ${
                  failed || fixedByFormula
                    ? "border-red-400"
                    : highlight
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
                      : "border-black/15 dark:border-white/15"
                }`}
                inputMode="decimal"
                placeholder="—"
                value={display[v.name]}
                onChange={(e) => edit(v.name, e.target.value)}
              />
              {failed && <span className="text-xs text-red-600 dark:text-red-400">No values fit this</span>}
              {fixedByFormula && (
                <span className="text-xs text-red-600 dark:text-red-400">Fixed by its formula, can&apos;t be changed</span>
              )}
              {v.formula && !failed && !fixedByFormula && (
                <code className="truncate font-mono text-xs text-black/40 dark:text-white/40">{v.formula}</code>
              )}
            </label>
          );
        })}
      </div>
      {broken.length > 0 && (
        <ul className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {broken.map((f) => (
            <li key={f.line}>
              <code className="font-mono">{f.text}</code> doesn&apos;t hold with these values.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
