"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  brokenFormulas,
  decidedBy,
  formatDecimals,
  formatNumber,
  parseValue,
  planSolve,
  solve,
  type Analysis,
} from "@/lib/formulas";

function compute(analysis: Analysis, values: Record<string, string>, locked: string[]) {
  const plan = planSolve(analysis, locked);
  const numbers = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseValue(v)]));
  const result = solve(analysis, plan, numbers, numbers);
  // Values being kept show their exact text; everything else shows the calculated number.
  const display: Record<string, string> = {};
  for (const v of analysis.variables) {
    display[v.name] = plan.held.includes(v.name) ? (values[v.name] ?? "") : formatNumber(result.values[v.name]);
  }
  return { plan, result, display, broken: brokenFormulas(analysis, plan, result.values) };
}

type Computed = ReturnType<typeof compute>;
type Rejected = { name: string; text: string; reason: string };

// One list of variables, all editable. A value the user types is locked and never changed by
// the formulas; every unlocked variable is recalculated so all formulas still hold.
export function CalculatorPanel({
  analysis,
  values,
  onChange,
  descriptions,
  units,
  labels,
  decimals,
}: {
  analysis: Analysis;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** A short note per variable name, shown as a tooltip on the name. */
  descriptions?: Record<string, string>;
  /** A unit label per variable name, shown after the value. */
  units?: Record<string, string>;
  /** A display name per variable name, shown instead of the variable name. */
  labels?: Record<string, string>;
  /** Decimals to show per variable name for calculated values. Display only. */
  decimals?: Record<string, number>;
}) {
  // Locked variables, in the order they were locked.
  const [locked, setLocked] = useState<string[]>([]);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // A value that couldn't be applied stays visible in its field with the reason.
  const [rejected, setRejected] = useState<Rejected | null>(null);
  // A field that was just cleared (or holds half a number like "-") keeps what was typed while it
  // has focus, instead of being refilled by a calculated value mid-edit.
  const [draft, setDraft] = useState<{ name: string; text: string } | null>(null);

  // An edit already computes its result to decide whether to accept it. Remember that, so the
  // render that follows doesn't solve the same thing a second time.
  const [computedByEdit, setComputedByEdit] = useState<{
    values: Record<string, string>;
    locked: string[];
    out: Computed;
  } | null>(null);
  const { display, broken, plan } = useMemo(() => {
    if (computedByEdit && computedByEdit.values === values && computedByEdit.locked === locked) {
      return computedByEdit.out;
    }
    return compute(analysis, values, locked);
  }, [analysis, values, locked, computedByEdit]);
  const decided = useMemo(() => decidedBy(analysis, locked), [analysis, locked]);
  // What is shown. `display` keeps full precision because it is fed back into the next solve;
  // rounding is only applied here. Values the user typed are shown exactly as typed.
  const shown = useMemo(() => {
    if (!decimals) return display;
    const out = { ...display };
    for (const [name, places] of Object.entries(decimals)) {
      const n = parseValue(display[name]);
      if (n !== undefined && !plan.held.includes(name)) out[name] = formatDecimals(n, places);
    }
    return out;
  }, [display, decimals, plan]);

  // Recalculated values briefly flash in the accent color so the change is noticed.
  const flash = useCallback((names: string[]) => {
    const styles = getComputedStyle(document.documentElement);
    const from = styles.getPropertyValue("--accent").trim();
    const to = styles.getPropertyValue("--ink").trim();
    for (const name of names) {
      const el = inputs.current.get(name);
      if (!el) continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ color: from }, { color: from, offset: 0.35 }, { color: to }], { duration: 2000, easing: "ease-in" });
    }
  }, []);

  // The handlers below are shared by every row and read the latest state from here, so rows
  // can stay memoized and only the ones whose values changed re-render.
  const latest = useRef({ analysis, locked, display, onChange, labels });
  useLayoutEffect(() => {
    latest.current = { analysis, locked, display, onChange, labels };
  });

  const apply = useCallback(
    (nextLocked: string[], nextValues: Record<string, string>, edited?: { name: string; text: string }) => {
      const { analysis, display, onChange, labels } = latest.current;
      // A variable with no value (shown as "?") is never locked: there is nothing to keep.
      const unspecified = edited !== undefined && parseValue(edited.text) === undefined;
      const lockedNow = unspecified ? nextLocked.filter((n) => n !== edited.name) : nextLocked;
      const next = compute(analysis, nextValues, lockedNow);
      if (edited && !unspecified && !next.plan.held.includes(edited.name)) {
        const constant = analysis.formulas.some((f) => !f.error && f.name === edited.name && f.vars.length === 1);
        const others = nextLocked.filter((n) => n !== edited.name).map((n) => labels?.[n] || n);
        const reason = constant
          ? "Fixed by its formula, can't be changed"
          : `Already decided by locked ${others.join(", ")}. Unlock one to change this.`;
        setRejected({ ...edited, reason });
        return;
      }
      if (edited && !unspecified && next.result.failed) {
        setRejected({ ...edited, reason: "No values fit this with the current locks" });
        return;
      }
      setRejected(null);
      setDraft(unspecified ? edited : null);
      flash(analysis.variables.map((v) => v.name).filter((n) => n !== edited?.name && next.display[n] !== display[n]));
      setComputedByEdit({ values: next.display, locked: lockedNow, out: next });
      setLocked(lockedNow);
      // Store calculated values too, so the next change starts from what's on screen.
      onChange(next.display);
    },
    [flash],
  );

  const edit = useCallback(
    (name: string, text: string) => {
      const { locked, display } = latest.current;
      apply([...locked.filter((n) => n !== name), name], { ...display, [name]: text }, { name, text });
    },
    [apply],
  );

  const toggleLock = useCallback(
    (name: string) => {
      const { locked, display } = latest.current;
      if (locked.includes(name)) apply(locked.filter((n) => n !== name), display);
      else if (parseValue(display[name]) !== undefined) edit(name, display[name]); // nothing to lock without a value
    },
    [apply, edit],
  );

  const endDraft = useCallback((name: string) => setDraft((d) => (d?.name === name ? null : d)), []);

  const register = useCallback((name: string, el: HTMLInputElement | null) => {
    if (el) inputs.current.set(name, el);
    else inputs.current.delete(name);
  }, []);

  if (analysis.variables.length === 0) {
    return <p className="text-ink-muted">Variables from your formulas show up here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
        {analysis.variables.map((v) => {
          const problem = rejected?.name === v.name ? rejected : null;
          return (
            <VariableRow
              key={v.name}
              name={v.name}
              formula={v.formula}
              description={descriptions?.[v.name]}
              unit={units?.[v.name]}
              label={labels?.[v.name]}
              value={problem ? problem.text : draft?.name === v.name ? draft.text : shown[v.name]}
              problem={problem?.reason ?? null}
              canLock={parseValue(display[v.name]) !== undefined}
              readOnly={decided.has(v.name) && !problem}
              locked={locked.includes(v.name)}
              onEdit={edit}
              onToggleLock={toggleLock}
              onBlur={endDraft}
              register={register}
            />
          );
        })}
      </div>
      {broken.length > 0 && (
        <ul className="sketch-box px-4 py-3 text-danger">
          {broken.map((f) => (
            <li key={f.line}>{f.text} doesn&apos;t hold with these values.</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Written like a line on the board: name = value
const VariableRow = memo(function VariableRow({
  name,
  formula,
  description,
  unit,
  label,
  value,
  problem,
  readOnly,
  locked,
  canLock,
  onEdit,
  onToggleLock,
  onBlur,
  register,
}: {
  name: string;
  formula?: string;
  description?: string;
  unit?: string;
  label?: string;
  value: string;
  problem: string | null;
  readOnly: boolean;
  locked: boolean;
  /** False while the variable has no value: there is nothing to lock. */
  canLock: boolean;
  onEdit: (name: string, text: string) => void;
  onToggleLock: (name: string) => void;
  onBlur: (name: string) => void;
  register: (name: string, el: HTMLInputElement | null) => void;
}) {
  const id = `var-${name}`;
  return (
    <div className="flex min-w-0 flex-col">
      <span className={`flex items-center gap-2 ${readOnly ? "row-decided" : ""}`}>
        <VariableName name={name} label={label || name} inputId={id} description={description} />
        <span className="text-xl text-ink-muted">=</span>
        <input
          id={id}
          ref={(el) => register(name, el)}
          className={`field min-w-0 flex-1 rounded-sm text-2xl ${problem ? "!border-danger" : ""} ${
            readOnly ? "field-decided" : ""
          }`}
          inputMode="decimal"
          placeholder="?"
          aria-label={description || label ? label || name : undefined}
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          value={value}
          onChange={(e) => onEdit(name, e.target.value)}
          onBlur={() => onBlur(name)}
        />
        {unit && <span className="shrink-0 text-lg text-ink-muted">{unit}</span>}
        {readOnly ? (
          <span className="w-[30px] shrink-0" aria-hidden />
        ) : (
          <LockButton locked={locked} disabled={!locked && !canLock} label={label || name} onClick={() => onToggleLock(name)} />
        )}
      </span>
      {problem && <span className="text-sm text-danger">{problem}</span>}
      {formula && !problem && <span className="truncate pt-0.5 text-sm text-accent-2">{formula}</span>}
    </div>
  );
});

// The variable's name. When it has a note, the name is dotted-underlined and the note appears as a
// tooltip: on hover with a mouse, on keyboard focus, and on tap, which also works on phones.
function VariableName({
  name,
  label,
  inputId,
  description,
}: {
  name: string;
  label: string;
  inputId: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!description) {
    return (
      <label htmlFor={inputId} title={label !== name ? name : undefined} className="max-w-[55%] shrink-0 break-words text-xl">
        {label}
      </label>
    );
  }

  const tipId = `${inputId}-note`;
  return (
    <span ref={wrapper} className="group relative max-w-[55%] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-describedby={tipId}
        aria-expanded={open}
        title={label !== name ? name : undefined}
        className="break-words text-left text-xl underline decoration-ink-faint decoration-dotted underline-offset-4"
      >
        {label}
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={`tooltip ${open ? "block" : "hidden"} group-hover:block group-has-[:focus-visible]:block`}
      >
        {description}
      </span>
    </span>
  );
}

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
        locked ? "text-accent" : disabled ? "cursor-not-allowed text-ink-faint opacity-40" : "text-ink-faint hover:text-ink-muted"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        {locked ? <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /> : <path d="M8 10.5V7a4 4 0 0 1 7.6-1.7" />}
      </svg>
    </button>
  );
}
