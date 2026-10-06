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
    return <p className="text-ink-muted">Variables from your formulas show up here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
        {analysis.variables.map((v) => {
          const fixedByFormula = v.name === lastEdited && !plan.held.includes(v.name);
          const failed = result.failed && v.name === lastEdited;
          const highlight = changed.includes(v.name);
          return (
            <label key={v.name} className="flex min-w-0 flex-col">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-lg">{v.label}</span>
                <span className="text-sm text-ink-faint">{v.name}</span>
              </span>
              <input
                className={`field rounded-sm text-2xl ${
                  failed || fixedByFormula ? "!border-danger" : highlight ? "bg-mark" : ""
                }`}
                inputMode="decimal"
                placeholder="?"
                value={display[v.name]}
                onChange={(e) => edit(v.name, e.target.value)}
              />
              {failed && <span className="text-sm text-danger">No values fit this</span>}
              {fixedByFormula && <span className="text-sm text-danger">Fixed by its formula, can&apos;t be changed</span>}
              {v.formula && !failed && !fixedByFormula && (
                <span className="truncate pt-0.5 text-sm text-accent-2">{v.formula}</span>
              )}
            </label>
          );
        })}
      </div>
      {broken.length > 0 && (
        <ul className="sketch-box px-4 py-3 text-danger">
          {broken.map((f) => (
            <li key={f.line}>{f.text} doesn&apos;t hold with these values.</li>
          ))}
        </ul>
      )}
    </div>
  );
}