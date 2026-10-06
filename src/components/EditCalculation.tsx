"use client";

import { useSyncExternalStore } from "react";
import type { Calculation } from "@/lib/calculation";
import { getEditKey } from "@/lib/my-calculations";
import { CalculationEditor } from "./CalculationEditor";

const subscribe = () => () => {};

// The edit key only exists in the creator's browser, so whether this is an edit or a copy
// is decided after hydration. Without the key, saving makes a new calculation.
export function EditCalculation({ calculation }: { calculation: Calculation }) {
  const editKey = useSyncExternalStore(
    subscribe,
    () => getEditKey(calculation.id) ?? "",
    () => null,
  );
  if (editKey === null) return null;

  if (editKey) {
    return (
      <CalculationEditor
        initial={calculation}
        editing={{ id: calculation.id, editKey }}
        heading={`Edit ${calculation.title}`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sketch-box px-4 py-3 text-ink-muted">
        This calculation was made in another browser, so you can&apos;t change it. Saving here makes your own copy
        with a new link.
      </p>
      <CalculationEditor
        initial={{ ...calculation, title: `${calculation.title} (copy)` }}
        heading={`Copy ${calculation.title}`}
      />
    </div>
  );
}
