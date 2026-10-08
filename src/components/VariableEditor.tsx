"use client";

import { useId, useState } from "react";
import { LIMITS } from "@/lib/calculation";
import { groupOf } from "@/lib/boards";
import { displayName, type Analysis, type Variable } from "@/lib/formulas";
import { checkVariableName } from "@/lib/rename";

// Units people commonly want, offered as suggestions while typing a unit.
const COMMON_UNITS = ["%", "m", "m²", "m³", "cm", "mm", "km", "kg", "g", "s", "ms", "min", "h", "km/h", "m/s", "/s", "°C", "$", "€", "£", "USD", "kW", "kWh", "W", "V", "A", "L", "px"];

// One line per variable: its name, which can be changed (the formulas are rewritten to match),
// a unit such as % or m², and a short note about what it means. People see the unit and the note
// on the shared page.
export function VariableEditor({
  analysis,
  groups,
  descriptions,
  units,
  labels,
  hidden,
  links,
  ownLinks,
  decimals,
  onRename,
  onDescribe,
  onUnit,
  onLabel,
  onHide,
  onLink,
  onDecimals,
}: {
  analysis: Analysis;
  /** The boards in use, by alias. Their variables are listed under their title. */
  groups: Record<string, { title: string; board: string }>;
  descriptions: Record<string, string>;
  units: Record<string, string>;
  labels: Record<string, string>;
  /** Variables hidden from the board. */
  hidden: Record<string, boolean>;
  /** Every link, including those made by used boards, by variable name. */
  links: Record<string, string>;
  /** The links made on this board, which are the ones that can be changed here. */
  ownLinks: Record<string, string>;
  /** Decimals to show per variable, as typed (empty means automatic). */
  decimals: Record<string, string>;
  onRename: (from: string, to: string) => void;
  onDescribe: (name: string, text: string) => void;
  onUnit: (name: string, unit: string) => void;
  onLabel: (name: string, label: string) => void;
  onHide: (name: string, hidden: boolean) => void;
  /** Links a variable to another (by the other's internal name), or removes the link (null). */
  onLink: (name: string, target: string | null) => void;
  onDecimals: (name: string, decimals: string) => void;
}) {
  // The section can be folded away once the names, units and notes are as wanted. Its fields stay
  // mounted while hidden, so a half-typed name isn't lost.
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  if (analysis.variables.length === 0) return null;

  // This board's own variables first, then those of each board in use.
  const topGroups = Object.keys(groups).filter((key) => !key.includes("$"));
  const sections: { key: string | null; variables: Variable[] }[] = [
    { key: null, variables: analysis.variables.filter((v) => !topGroups.includes(groupOf(v.name) ?? "")) },
    ...topGroups.map((key) => ({ key, variables: analysis.variables.filter((v) => groupOf(v.name) === key) })),
  ].filter((section) => section.variables.length > 0);

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
          Rename a variable and every formula that uses it is updated. A display name is shown instead of it on the
          rows (the formulas still use the real name). Hide a variable to keep it off the board while it still takes part in the maths. A unit (like % or m²) is shown next to the
          value, decimals set how many digits a calculated value shows, and a note is shown under the variable.
          Units and decimals only change what is displayed, never the maths.
        </p>
      </div>
      <div id={bodyId} className={open ? "flex flex-col gap-3" : "hidden"}>
      <datalist id="link-targets">
        {analysis.variables.map((v) => (
          <option key={v.name} value={displayName(v.name)} />
        ))}
      </datalist>
      <datalist id="unit-suggestions">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.key ?? "own"} className={`flex flex-col gap-4 ${sections.length > 1 ? "group-box" : ""}`}>
            {section.key && groups[section.key] && (
              <h3 className="group-title">
                {groups[section.key].title}{" "}
                <span className="text-base text-ink-faint">
                  (used as {section.key}; its names can&apos;t be changed here, but everything else can)
                </span>
              </h3>
            )}
            {section.variables.map((v) => (
              <VariableLine
                key={v.name}
                name={v.name}
                fixedName={section.key ? displayName(v.name.slice(section.key.length + 1)) : undefined}
                unit={units[v.name] ?? ""}
                label={labels[v.name] ?? ""}
                hidden={hidden[v.name] === true}
                linkedTo={links[v.name] ? displayName(links[v.name]) : ""}
                linkLocked={v.name in links && !(v.name in ownLinks)}
                decimals={decimals[v.name] ?? ""}
                description={descriptions[v.name] ?? ""}
                validate={(next) => checkVariableName(next, v.name, analysis)}
                onRename={(next) => onRename(v.name, next)}
                onDescribe={(text) => onDescribe(v.name, text)}
                onUnit={(unit) => onUnit(v.name, unit)}
                onLabel={(text) => onLabel(v.name, text)}
                onHide={(value) => onHide(v.name, value)}
                onLink={(text) => {
                  const target = text.trim().replaceAll(".", "$");
                  if (!target) {
                    onLink(v.name, null);
                    return null;
                  }
                  if (!analysis.variables.some((other) => other.name === target)) {
                    return `No variable called ${text.trim()}`;
                  }
                  if (target === v.name) return "A variable can't be linked to itself";
                  onLink(v.name, target);
                  return null;
                }}
                onDecimals={(text) => onDecimals(v.name, text)}
              />
            ))}
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

function VariableLine({
  name,
  fixedName,
  unit,
  label,
  hidden,
  linkedTo,
  linkLocked,
  decimals,
  description,
  validate,
  onRename,
  onDescribe,
  onUnit,
  onLabel,
  onHide,
  onLink,
  onDecimals,
}: {
  name: string;
  /** Set for a variable of a board in use: its name is shown but not editable. */
  fixedName?: string;
  unit: string;
  label: string;
  hidden: boolean;
  /** The variable this one is linked to, written as a person would (board.variable), or empty. */
  linkedTo: string;
  /** True when the link comes from a used board, so it can't be changed here. */
  linkLocked: boolean;
  decimals: string;
  description: string;
  validate: (name: string) => string | null;
  onRename: (name: string) => void;
  onDescribe: (text: string) => void;
  onUnit: (unit: string) => void;
  onLabel: (label: string) => void;
  onHide: (hidden: boolean) => void;
  /** Applies a link typed by the user. Returns why it can't be used, or null when it was applied. */
  onLink: (text: string) => string | null;
  onDecimals: (decimals: string) => void;
}) {
  // The link is applied when the field is left or Enter is pressed, like the name.
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  function commitLink() {
    if (linkDraft === null) return;
    const problem = onLink(linkDraft);
    setLinkError(problem);
    if (!problem) setLinkDraft(null);
  }

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
    <div className="variable-box flex flex-col gap-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
        {fixedName !== undefined ? (
          <div className="flex items-end pb-1 text-xl text-ink-muted sm:w-[38%]" title={displayName(name)}>
            {fixedName}
          </div>
        ) : (
        <input
          className={`field text-xl sm:w-[38%] ${error ? "!border-danger" : ""}`}
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
        )}
        <input
          className="field text-lg sm:flex-1"
          value={label}
          maxLength={LIMITS.label}
          placeholder="Display name (optional)"
          onChange={(e) => onLabel(e.target.value)}
          aria-label={`Display name of ${name}`}
        />
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <input
          className="field w-24 text-lg"
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
        <input
          className="field w-24 text-lg"
          value={decimals}
          inputMode="numeric"
          placeholder="decimals"
          onChange={(e) => {
            // Whole numbers from 0 to 10; anything else is dropped as it is typed.
            const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
            onDecimals(digits !== "" && Number(digits) > LIMITS.maxDecimals ? String(LIMITS.maxDecimals) : digits);
          }}
          aria-label={`Decimals of ${name}`}
          title="How many decimals to show for the calculated value. Empty shows it automatically."
        />
        <input
          className={`field w-48 text-lg ${linkError ? "!border-danger" : ""}`}
          value={linkDraft ?? linkedTo}
          list="link-targets"
          placeholder="linked to…"
          disabled={linkLocked}
          title={
            linkLocked
              ? "This link comes from a board that is used"
              : "Link this variable to another: the two follow each other"
          }
          onChange={(e) => {
            setLinkDraft(e.target.value);
            setLinkError(null);
          }}
          onBlur={commitLink}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitLink();
            } else if (e.key === "Escape") {
              setLinkDraft(null);
              setLinkError(null);
            }
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Variable ${displayName(name)} is linked to`}
        />
        <label className="flex shrink-0 items-center gap-2 pb-1 text-lg" title="Hidden variables still take part in the calculation, but are not shown on the board.">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => onHide(e.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
            aria-label={`Hide ${name} from the board`}
          />
          Hide
        </label>
        <input
          className="field min-w-[10rem] w-full text-lg sm:w-auto sm:flex-1"
          value={description}
          maxLength={LIMITS.variableDescription}
          placeholder="What is this? (optional)"
          onChange={(e) => onDescribe(e.target.value)}
          aria-label={`Note about ${name}`}
        />
      </div>
      {error && <span className="text-sm text-danger">{error}</span>}
      {linkError && <span className="text-sm text-danger">{linkError}</span>}
    </div>
  );
}