"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";

// A text field whose change is applied when it is left or Enter is pressed (Escape drops it), not on every
// keystroke. Used where a half-typed value must not take effect: a variable's name rewrites the formulas, a
// link joins two variables, a board's alias rewrites formulas too. `apply` gets the trimmed text and says why
// it can't be used, or returns null when it was applied.
export function useCommitField(value: string, apply: (text: string) => string | null) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const problem = apply(draft.trim());
    setError(problem);
    if (!problem) setDraft(null);
  }

  function cancel() {
    setDraft(null);
    setError(null);
  }

  return {
    /** Why the last attempt was refused, if it was. */
    error,
    inputProps: {
      value: draft ?? value,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        setDraft(e.target.value);
        setError(null);
      },
      onBlur: commit,
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          cancel();
        }
      },
    },
  };
}
