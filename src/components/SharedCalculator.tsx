"use client";

import { useMemo, useState } from "react";
import type { Bundle } from "@/lib/boards";
import { analyzeFormulas } from "@/lib/formulas";
import { CalculatorPanel } from "./CalculatorView";

// `flat` is the board together with the boards it uses, as one set of formulas and settings.
export function SharedCalculator({ flat }: { flat: Bundle }) {
  const analysis = useMemo(() => analyzeFormulas(flat.formulas), [flat.formulas]);
  const [values, setValues] = useState(flat.values);
  // Bumping the key remounts the panel, which also forgets the edit history.
  const [resets, setResets] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {values !== flat.values && (
        <button
          type="button"
          onClick={() => {
            setValues(flat.values);
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
        descriptions={flat.descriptions}
        units={flat.units}
        labels={flat.labels}
        hidden={flat.hidden}
        decimals={flat.decimals}
        groups={flat.groups}
      />
    </div>
  );
}
