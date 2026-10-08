"use client";

import { LIMITS } from "@/lib/board-draft";
import { displayName } from "@/lib/formulas";
import { Foldable } from "./ui/Foldable";
import { useCommitField } from "./ui/useCommitField";

// One variable in the editor: its name, which can be changed (the formulas are rewritten to match), a
// display name, a unit, decimals, a link to another variable, whether it is hidden, and a note.
export function VariableLine({
  name,
  expanded,
  onToggle,
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
  expanded: boolean;
  onToggle: () => void;
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
  /** Why this can't be the variable's new name, or null. */
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
  // Applied when the field is left, so half-typed names never rewrite the formulas. After a rename the line
  // is replaced under its new name, so this component starts over with a clean draft.
  const rename = useCommitField(name, (next) => {
    if (next === name) return null;
    const problem = validate(next);
    if (problem) return problem;
    onRename(next);
    return null;
  });
  const link = useCommitField(linkedTo, onLink);

  return (
    <Foldable
      expanded={expanded}
      onToggle={onToggle}
      summary={label || fixedName || displayName(name)}
      hint={`${unit ? ` · ${unit}` : ""}${hidden ? " · hidden" : ""}${linkedTo ? ` · linked to ${linkedTo}` : ""}`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-3">
        {fixedName !== undefined ? (
          <div className="flex items-end pb-1 text-xl text-ink-muted sm:w-[38%]" title={displayName(name)}>
            {fixedName}
          </div>
        ) : (
          <input
            {...rename.inputProps}
            className={`field text-xl sm:w-[38%] ${rename.error ? "!border-danger" : ""}`}
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
          {...link.inputProps}
          className={`field w-48 text-lg ${link.error ? "!border-danger" : ""}`}
          list="link-targets"
          placeholder="linked to…"
          disabled={linkLocked}
          title={
            linkLocked
              ? "This link comes from a board that is used"
              : "Link this variable to another: the two follow each other"
          }
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Variable ${displayName(name)} is linked to`}
        />
        <label
          className="flex shrink-0 items-center gap-2 pb-1 text-lg"
          title="Hidden variables still take part in the maths, but are not shown on the board."
        >
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
          className="field w-full min-w-[10rem] text-lg sm:w-auto sm:flex-1"
          value={description}
          maxLength={LIMITS.variableDescription}
          placeholder="What is this? (optional)"
          onChange={(e) => onDescribe(e.target.value)}
          aria-label={`Note about ${name}`}
        />
      </div>
      {rename.error && <span className="text-sm text-danger">{rename.error}</span>}
      {link.error && <span className="text-sm text-danger">{link.error}</span>}
    </Foldable>
  );
}
