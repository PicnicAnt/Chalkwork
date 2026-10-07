"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/calculation";
import type { Analysis } from "@/lib/formulas";
import { checkVariableName } from "@/lib/rename";

// One line per variable: its name, which can be changed (the formulas are rewritten to match),
// and a short note about what it means that people see on the shared page.
export function VariableEditor({
  analysis,
  descriptions,
  onRename,
  onDescribe,
}: {
  analysis: Analysis;
  descriptions: Record<string, string>;
  onRename: (from: string, to: string) => void;
  onDescribe: (name: string, text: string) => void;
}) {
  if (analysis.variables.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">Variables</h2>
        <p className="text-base text-ink-muted">
          Rename a variable and every formula that uses it is updated. Notes show up next to the variable for anyone
          who opens the calculation.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {analysis.variables.map((v) => (
          <VariableLine
            key={v.name}
            name={v.name}
            description={descriptions[v.name] ?? ""}
            validate={(next) => checkVariableName(next, v.name, analysis)}
            onRename={(next) => onRename(v.name, next)}
            onDescribe={(text) => onDescribe(v.name, text)}
          />
        ))}
      </div>
    </section>
  );
}

function VariableLine({
  name,
  description,
  validate,
  onRename,
  onDescribe,
}: {
  name: string;
  description: string;
  validate: (name: string) => string | null;
  onRename: (name: string) => void;
  onDescribe: (text: string) => void;
}) {
  // The new name is applied when the field is left or Enter is pressed, so half-typed names
  // never rewrite the formulas.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = draft.trim();
    if (next === name) {
      setDraft(null);
      setError(null);
      return;
    }
    const problem = validate(next);
    if (problem) {
      setError(problem);
      return;
    }
    // The line is replaced under its new name, so this component starts over with a clean draft.
    onRename(next);
  }

  function cancel() {
    setDraft(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-4">
        <input
          className={`field text-xl sm:w-2/5 ${error ? "!border-danger" : ""}`}
          value={draft ?? name}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Name of ${name}`}
        />
        <input
          className="field text-lg sm:flex-1"
          value={description}
          maxLength={LIMITS.variableDescription}
          placeholder="What is this? (optional)"
          onChange={(e) => onDescribe(e.target.value)}
          aria-label={`Note about ${name}`}
        />
      </div>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
