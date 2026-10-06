"use client";

import { useMemo, useState } from "react";
import type { Calculation } from "@/lib/calculation";
import { evaluateCalculation } from "@/lib/evaluate";

export function CalculatorView({ calculation }: { calculation: Calculation }) {
  const [inputs, setInputs] = useState(calculation.inputs);
  const results = useMemo(() => evaluateCalculation(inputs, calculation.outputs), [inputs, calculation.outputs]);
  const changed = inputs.some((input, i) => input.value !== calculation.inputs[i].value);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Inputs</h2>
          {changed && (
            <button
              type="button"
              onClick={() => setInputs(calculation.inputs)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset
            </button>
          )}
        </div>
        {inputs.length === 0 && <p className="text-sm text-black/50 dark:text-white/50">No inputs.</p>}
        {inputs.map((input, i) => (
          <label key={i} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{input.label}</span>
            <input
              className="rounded-md border border-black/15 bg-white px-3 py-2 font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/5"
              inputMode="decimal"
              value={input.value}
              onChange={(e) => setInputs(inputs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
            />
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Results</h2>
        <dl className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
          {results.map((result, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-sm">
                {result.label}
                <code className="mt-0.5 block font-mono text-xs text-black/40 dark:text-white/40">
                  {calculation.outputs[i].formula}
                </code>
              </dt>
              <dd className={result.error ? "text-sm text-red-600 dark:text-red-400" : "font-mono text-lg font-semibold"}>
                {result.error ?? result.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
