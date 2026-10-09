"use client";

import { memo, useState } from "react";
import type { Range } from "@/lib/boards";
import { displayName, formatNumber, parseValue } from "@/lib/formulas";

// Written like a line on the board: name = value
export const VariableRow = memo(function VariableRow({
  name,
  description,
  unit,
  unitOptions,
  ratio = 1,
  label,
  hidden,
  linkedTo,
  value,
  problem,
  readOnly,
  locked,
  canLock,
  onEdit,
  onToggleLock,
  onUnit,
  onBlur,
  register,
  range,
  current,
}: {
  name: string;
  description?: string;
  /** The unit the value is shown in. */
  unit?: string;
  /** Other units of the same kind it can be shown in (the first is the unit it was written in). */
  unitOptions?: string[];
  /** By what a number written in the first unit is multiplied to be shown in `unit`. */
  ratio?: number;
  label?: string;
  hidden?: boolean;
  /** The variable this one is linked to, shown under it. */
  linkedTo?: string;
  value: string;
  problem: string | null;
  readOnly: boolean;
  locked: boolean;
  /** False while the variable has no value: there is nothing to lock. */
  canLock: boolean;
  onEdit: (name: string, text: string) => void;
  onToggleLock: (name: string) => void;
  onUnit: (name: string, unit: string) => void;
  onBlur: (name: string) => void;
  register: (name: string, el: HTMLInputElement | null) => void;
  /** The values this should stay within (in the unit it is written in), for the warning and the slider. */
  range?: Range;
  /** The value now, in the unit it is written in. */
  current?: number;
}) {
  const id = `var-${name}`;
  // Typed in a unit other than the one the board is worked out in, the number is converted before it is used.
  // What was typed stays in the field while it is being edited, so "1." and "1.50" aren't rewritten under the cursor.
  // It is only kept for the unit it was typed in.
  const [typed, setTyped] = useState<{ text: string; unit?: string } | null>(null);
  // Outside its range is a warning, not an error. With both ends known a slider can move it.
  const outside =
    range && current !== undefined
      ? range.min !== undefined && current < range.min
        ? `Below the lowest value, ${formatNumber(range.min * ratio)}`
        : range.max !== undefined && current > range.max
          ? `Above the highest value, ${formatNumber(range.max * ratio)}`
          : null
      : null;
  const slidable = !readOnly && range?.min !== undefined && range.max !== undefined && range.max > range.min;
  const shownText = typed && typed.unit === unit ? typed.text : value;
  return (
    <div className={`row-focus -mx-2 -my-1 flex min-w-0 flex-col px-2 py-1 ${hidden ? "opacity-60" : ""}`}>
      <span className="flex items-center gap-2">
        <label
          htmlFor={id}
          title={label && label !== name ? displayName(name) : undefined}
          className="max-w-[55%] shrink-0 break-words text-xl"
        >
          {label || name}
        </label>
        <span className="text-xl text-ink-muted">=</span>
        {/* The field is only as wide as its text, so the unit follows the value directly and the double line of a
            fixed value sits under the value alone. */}
        <span className="flex min-w-0 flex-1 items-baseline">
        <input
          id={id}
          ref={(el) => register(name, el)}
          style={{ width: `${Math.max(shownText.length, readOnly ? 1 : 3) + 1}ch`, maxWidth: "calc(100% - 3rem)" }}
          className={`field min-w-0 flex-none rounded-sm text-2xl ${problem ? "!border-danger" : ""} ${
            readOnly ? "field-decided" : locked ? "field-bare field-locked" : "field-bare"
          }`}
          inputMode="decimal"
          placeholder="?"
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          value={shownText}
          onChange={(e) => {
            const text = e.target.value;
            const n = parseValue(text);
            if (ratio === 1 || n === undefined) {
              setTyped(null);
              onEdit(name, text);
            } else {
              setTyped({ text, unit });
              onEdit(name, formatNumber(n / ratio));
            }
          }}
          onBlur={() => {
            setTyped(null);
            onBlur(name);
          }}
        />
        {unit &&
          (unitOptions && unitOptions.length > 1 ? (
            <select
              value={unit}
              onChange={(e) => onUnit(name, e.target.value)}
              aria-label={`Unit to show ${label || name} in`}
              title="Show this in another unit"
              className="ml-1 shrink-0 cursor-pointer bg-transparent text-lg text-ink-muted"
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          ) : (
            <span className="shrink-0 text-lg text-ink-muted">{unit}</span>
          ))}
        </span>
        {hidden && <span className="shrink-0 text-sm text-ink-faint">hidden</span>}
        {readOnly ? (
          <span className="w-[30px] shrink-0" aria-hidden />
        ) : (
          <LockButton locked={locked} disabled={!locked && !canLock} label={label || name} onClick={() => onToggleLock(name)} />
        )}
      </span>
      {slidable && range && (
        <input
          type="range"
          className="slider mt-1 w-full"
          min={range.min}
          max={range.max}
          step="any"
          value={Math.min(range.max!, Math.max(range.min!, current ?? range.min!))}
          onChange={(e) => {
            setTyped(null);
            onEdit(name, formatNumber(Number(Number(e.target.value).toPrecision(6))));
          }}
          aria-label={`Slide ${label || name}`}
        />
      )}
      {problem && <span className="text-sm text-danger">{problem}</span>}
      {outside && !problem && <span className="text-sm text-op">{outside}</span>}
      {description && !problem && <span className="pt-0.5 text-base leading-snug text-note">{description}</span>}
      {linkedTo && !problem && <span className="text-sm text-ink-faint">linked to {linkedTo}</span>}
    </div>
  );
});

function LockButton({
  locked,
  disabled,
  label,
  onClick,
}: {
  locked: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
      title={
        locked
          ? "Locked: formulas won't change this. Tap to unlock."
          : disabled
            ? "Enter a value to lock it"
            : "Tap to lock this value"
      }
      className={`shrink-0 p-1 transition-colors ${
        locked ? "text-locked" : disabled ? "cursor-not-allowed text-ink-faint opacity-40" : "text-ink-faint hover:text-ink-muted"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        {locked ? <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /> : <path d="M8 10.5V7a4 4 0 0 1 7.6-1.7" />}
      </svg>
    </button>
  );
}

