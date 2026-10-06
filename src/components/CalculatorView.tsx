"use client";

import { useMemo, useRef, useState } from "react";
import { brokenFormulas, decidedBy, formatNumber, parseValue, planSolve, solve, type Analysis } from "@/lib/formulas";

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

// One list of variables, all editable. A value the user types is locked and never changed by
// the formulas; every unlocked variable is recalculated so all formulas still hold.
export function CalculatorPanel({
  analysis,
  values,
  onChange,
}: {
  analysis: Analysis;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  // Locked variables, in the order they were locked.
  const [locked, setLocked] = useState<string[]>([]);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // A value that couldn't be applied stays visible in its field with the reason.
  const [rejected, setRejected] = useState<{ name: string; text: string; reason: string } | null>(null);
  const { display, broken } = useMemo(() => compute(analysis, values, locked), [analysis, values, locked]);
  const decided = useMemo(() => decidedBy(analysis, locked), [analysis, locked]);

  function apply(nextLocked: string[], nextValues: Record<string, string>, edited?: { name: string; text: string }) {
    const next = compute(analysis, nextValues, nextLocked);
    if (edited && !next.plan.held.includes(edited.name)) {
      const constant = analysis.formulas.some((f) => !f.error && f.name === edited.name && f.vars.length === 1);
      const others = nextLocked.filter((n) => n !== edited.name);
      const reason = constant
        ? "Fixed by its formula, can't be changed"
        : `Already decided by locked ${others.join(", ")}. Unlock one to change this.`;
      setRejected({ ...edited, reason });
      return;
    }
    if (edited && next.result.failed) {
      setRejected({ ...edited, reason: "No values fit this with the current locks" });
      return;
    }
    setRejected(null);
    flash(analysis.variables.map((v) => v.name).filter((n) => n !== edited?.name && next.display[n] !== display[n]));
    setLocked(nextLocked);
    // Store calculated values too, so the next change starts from what's on screen.
    onChange(next.display);
  }

  // Recalculated values briefly flash in the accent color so the change is noticed.
  function flash(names: string[]) {
    const styles = getComputedStyle(document.documentElement);
    const from = styles.getPropertyValue("--accent").trim();
    const to = styles.getPropertyValue("--ink").trim();
    for (const name of names) {
      inputs.current.get(name)?.animate([{ color: from }, { color: from, offset: 0.35 }, { color: to }], {
        duration: 2000,
        easing: "ease-in",
      });
    }
  }

  function edit(name: string, text: string) {
    apply([...locked.filter((n) => n !== name), name], { ...display, [name]: text }, { name, text });
  }

  function toggleLock(name: string) {
    if (locked.includes(name)) apply(locked.filter((n) => n !== name), display);
    else edit(name, display[name]);
  }

  if (analysis.variables.length === 0) {
    return <p className="text-ink-muted">Variables from your formulas show up here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
        {analysis.variables.map((v) => {
          const isLocked = locked.includes(v.name);
          const problem = rejected?.name === v.name ? rejected : null;
          const readOnly = decided.has(v.name) && !problem;
          const id = `var-${v.name}`;
          return (
            <div key={v.name} className="flex min-w-0 flex-col">
              {/* Written like a line on the board: name = value */}
              <span className="flex items-center gap-2">
                <label htmlFor={id} className="max-w-[55%] shrink-0 break-words text-xl">
                  {v.name}
                </label>
                <span className="text-xl text-ink-muted">=</span>
                <input
                  id={id}
                  ref={(el) => {
                    if (el) inputs.current.set(v.name, el);
                    else inputs.current.delete(v.name);
                  }}
                  className={`field min-w-0 flex-1 rounded-sm text-2xl ${problem ? "!border-danger" : ""} ${
                    readOnly ? "field-decided" : ""
                  }`}
                  inputMode="decimal"
                  placeholder="?"
                  readOnly={readOnly}
                  tabIndex={readOnly ? -1 : undefined}
                  value={problem ? problem.text : display[v.name]}
                  onChange={(e) => edit(v.name, e.target.value)}
                />
                {readOnly ? (
                  <span className="w-[30px] shrink-0" aria-hidden />
                ) : (
                  <LockButton locked={isLocked} label={v.name} onClick={() => toggleLock(v.name)} />
                )}
              </span>
              {problem && <span className="text-sm text-danger">{problem.reason}</span>}
              {v.formula && !problem && <span className="truncate pt-0.5 text-sm text-accent-2">{v.formula}</span>}
            </div>
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

function LockButton({ locked, label, onClick }: { locked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
      title={locked ? "Locked: formulas won't change this. Tap to unlock." : "Tap to lock this value"}
      className={`shrink-0 p-1 transition-colors ${locked ? "text-accent" : "text-ink-faint hover:text-ink-muted"}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        {locked ? <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /> : <path d="M8 10.5V7a4 4 0 0 1 7.6-1.7" />}
      </svg>
    </button>
  );
}
