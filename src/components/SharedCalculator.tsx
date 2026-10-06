"use client";

import { useMemo, useState } from "react";
import type { Calculation } from "@/lib/calculation";
import { analyzeFormulas } from "@/lib/formulas";
import { CalculatorPanel } from "./CalculatorView";

export function SharedCalculator({ calculation }: { calculation: Calculation }) {
  const analysis = useMemo(() => analyzeFormulas(calculation.formulas), [calculation.formulas]);
  const [values, setValues] = useState(calculation.values);
  // Bumping the key remounts the panel, which also forgets the edit history.
  const [resets, setResets] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Variables</h2>
        {values !== calculation.values && (
          <button
            type="button"
            onClick={() => {
              setValues(calculation.values);
              setResets(resets + 1);
            }}
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Reset
          </button>
        )}
      </div>
      <CalculatorPanel key={resets} analysis={analysis} values={values} onChange={setValues} />
    </div>
  );
}
