"use client";

import { useMemo, useState } from "react";
import type { Calculation } from "@/lib/calculation";
import { analyzeFormulas } from "@/lib/formulas";
import { CalculatorPanel } from "./CalculatorView";

export function SharedCalculator({ calculation }: { calculation: Calculation }) {
  const analysis = useMemo(() => analyzeFormulas(calculation.formulas), [calculation.formulas]);
  const [values, setValues] = useState(calculation.values);
  const changed = analysis.inputs.some((i) => (values[i.name] ?? "") !== (calculation.values[i.name] ?? ""));

  return (
    <CalculatorPanel
      analysis={analysis}
      values={values}
      onChange={setValues}
      onReset={changed ? () => setValues(calculation.values) : undefined}
    />
  );
}
