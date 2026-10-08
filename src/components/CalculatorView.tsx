"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  brokenFormulas,
  decidedBy,
  formatDecimals,
  displayName,
  formatNumber,
  parseValue,
  planSolve,
  solve,
  type Analysis,
} from "@/lib/formulas";
import { groupOf } from "@/lib/boards";

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
  hidden,
  revealHidden = false,
  links,
  groups,
  decimals,
}: {
  analysis: Analysis;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** A short note per variable name, shown under the variable. */
  descriptions?: Record<string, string>;
  /** A unit label per variable name, shown after the value. */
  units?: Record<string, string>;
  /** A display name per variable name, shown instead of the variable name. */
  labels?: Record<string, string>;
  /** Variables the creator hid. They still take part in every calculation but are not shown. */
  hidden?: Record<string, boolean>;
  /** Show hidden variables anyway, marked as hidden. The editor does this so its creator can see them. */
  revealHidden?: boolean;
  /** Variables linked to another variable, by name, shown under the variable. */
  links?: Record<string, string>;
  /** The boards behind variables that come from boards in use, by alias, for the headings. */
  groups?: Record<string, { title: string; board: string }>;
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
        const others = nextLocked.filter((n) => n !== edited.name).map((n) => labels?.[n] || displayName(n));
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
  if (!revealHidden && analysis.variables.every((v) => hidden?.[v.name] === true)) {
    return <p className="text-ink-muted">Every variable on this board is hidden.</p>;
  }

  // This board's own variables first, then the variables of each board in use under its title.
  const topGroups = Object.keys(groups ?? {}).filter((key) => !key.includes("$"));
  const sections = [
    { key: null as string | null, variables: analysis.variables.filter((v) => !topGroups.includes(groupOf(v.name) ?? "")) },
    ...topGroups.map((key) => ({ key, variables: analysis.variables.filter((v) => groupOf(v.name) === key) })),
  ].filter((section) => section.variables.length > 0);

  function row(v: { name: string }, group: string | null) {
    const isHidden = hidden?.[v.name] === true;
    if (isHidden && !revealHidden) return null;
    const problem = rejected?.name === v.name ? rejected : null;
    return (
      <VariableRow
        key={v.name}
        name={v.name}
        description={descriptions?.[v.name]}
        unit={units?.[v.name]}
        // A variable from a board in use is shown without the board''s alias, under that board''s heading.
        label={labels?.[v.name] || (group ? displayName(v.name.slice(group.length + 1)) : undefined)}
        hidden={isHidden}
        linkedTo={links?.[v.name] ? displayName(links[v.name]) : undefined}
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
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        const rows = section.variables.map((v) => row(v, section.key)).filter(Boolean);
        if (rows.length === 0) return null;
        return (
          <div key={section.key ?? "own"} className="flex flex-col gap-4">
            {section.key && groups?.[section.key] && (
              <h3 className="text-xl text-ink-muted">
                From{" "}
                <a
                  href={`/c/${groups[section.key].board}`}
                  target={revealHidden ? "_blank" : undefined}
                  rel="noopener"
                  className="link"
                >
                  {groups[section.key].title}
                </a>
              </h3>
            )}
            <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">{rows}</div>
          </div>
        );
      })}      {broken.length > 0 && (
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
  description,
  unit,
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
  onBlur,
  register,
}: {
  name: string;
  description?: string;
  unit?: string;
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
  onBlur: (name: string) => void;
  register: (name: string, el: HTMLInputElement | null) => void;
}) {
  const id = `var-${name}`;
  return (
    <div className={`row-focus -mx-2 -my-1 flex min-w-0 flex-col px-2 py-1 ${hidden ? "opacity-60" : ""}`}>
      <span className={`flex items-center gap-2 ${readOnly ? "row-decided" : ""}`}>
        <label
          htmlFor={id}
          title={label && label !== name ? displayName(name) : undefined}
          className="max-w-[55%] shrink-0 break-words text-xl"
        >
          {label || name}
        </label>
        <span className="text-xl text-ink-muted">=</span>
        <input
          id={id}
          ref={(el) => register(name, el)}
          className={`field min-w-0 flex-1 rounded-sm text-2xl ${problem ? "!border-danger" : ""} ${
            readOnly ? "field-decided" : "field-bare"
          }`}
          inputMode="decimal"
          placeholder="?"
          readOnly={readOnly}
          tabIndex={readOnly ? -1 : undefined}
          value={value}
          onChange={(e) => onEdit(name, e.target.value)}
          onBlur={() => onBlur(name)}
        />
        {unit && <span className="shrink-0 text-lg text-ink-muted">{unit}</span>}
        {hidden && <span className="shrink-0 text-sm text-ink-faint">hidden</span>}
        {readOnly ? (
          <span className="w-[30px] shrink-0" aria-hidden />
        ) : (
          <LockButton locked={locked} disabled={!locked && !canLock} label={label || name} onClick={() => onToggleLock(name)} />
        )}
      </span>
      {problem && <span className="text-sm text-danger">{problem}</span>}
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
