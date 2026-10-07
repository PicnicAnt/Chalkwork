"use client";

import { useId, useState } from "react";
import { LIMITS } from "@/lib/calculation";
import type { Analysis } from "@/lib/formulas";
import { checkVariableName } from "@/lib/rename";

// Units people commonly want, offered as suggestions while typing a unit.
const COMMON_UNITS = ["%", "m", "m²", "m³", "cm", "mm", "km", "kg", "g", "s", "ms", "min", "h", "km/h", "m/s", "/s", "°C", "$", "€", "£", "USD", "kW", "kWh", "W", "V", "A", "L", "px"];

// One line per variable: its name, which can be changed (the formulas are rewritten to match),
// a unit such as % or m², and a short note about what it means. People see the unit and the note
// on the shared page.
export function VariableEditor({
  analysis,
  descriptions,
  units,
  onRename,
  onDescribe,
  onUnit,
}: {
  analysis: Analysis;
  descriptions: Record<string, string>;
  units: Record<string, string>;
  onRename: (from: string, to: string) => void;
  onDescribe: (name: string, text: string) => void;
  onUnit: (name: string, unit: string) => void;
}) {
  // The section can be folded away once the names, units and notes are as wanted. Its fields stay
  // mounted while hidden, so a half-typed name isn't lost.
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  if (analysis.variables.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl font-bold">
            Variables <span className="text-lg font-normal text-ink-muted">({analysis.variables.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="link text-base"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
        <p className={`text-base text-ink-muted ${open ? "" : "hidden"}`}>
          Rename a variable and every formula that uses it is updated. A unit (like % or m²) is shown next to the
          value, and a note appears as a tooltip on the name. Units are labels only and don&apos;t change any maths.
        </p>
      </div>
      <div id={bodyId} className={open ? "flex flex-col gap-3" : "hidden"}>
      <datalist id="unit-suggestions">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="flex flex-col gap-4">
        {analysis.variables.map((v) => (
          <VariableLine
            key={v.name}
            name={v.name}
            unit={units[v.name] ?? ""}
            description={descriptions[v.name] ?? ""}
            validate={(next) => checkVariableName(next, v.name, analysis)}
            onRename={(next) => onRename(v.name, next)}
            onDescribe={(text) => onDescribe(v.name, text)}
            onUnit={(unit) => onUnit(v.name, unit)}
          />
        ))}
      </div>
      </div>
    </section>
  );
}

function VariableLine({
  name,
  unit,
  description,
  validate,
  onRename,
  onDescribe,
  onUnit,
}: {
  name: string;
  unit: string;
  description: string;
  validate: (name: string) => string | null;
  onRename: (name: string) => void;
  onDescribe: (text: string) => void;
  onUnit: (unit: string) => void;
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
        <div className="flex items-end gap-3 sm:w-1/2">
        <input
          className={`field min-w-0 flex-1 text-xl ${error ? "!border-danger" : ""}`}
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
          className="field w-24 shrink-0 text-lg"
          value={unit}
          maxLength={LIMITS.unit}
          list="unit-suggestions"
          placeholder="unit"
          onChange={(e) => onUnit(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Unit of ${name}`}
        />
        </div>
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
