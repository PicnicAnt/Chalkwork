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
    <div className="flex flex-col gap-4">
      {values !== calculation.values && (
        <button
          type="button"
          onClick={() => {
            setValues(calculation.values);
            setResets(resets + 1);
          }}
          className="link self-end text-base"
        >
          Erase and start over
        </button>
      )}
      <CalculatorPanel
        key={resets}
        analysis={analysis}
        values={values}
        onChange={setValues}
        descriptions={calculation.descriptions}
        units={calculation.units}
        decimals={calculation.decimals}
      />
    </div>
  );
}
