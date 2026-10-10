"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sectionsByBoard, type Range } from "@/lib/boards";
import { compute, initialLocks, shownValues, type Computed } from "@/lib/calculator";
import { decidedBy, displayName, formatDecimals, formatNumber, parseValue, type Analysis } from "@/lib/formulas";
import { alternatives, ratio as unitRatio } from "@/lib/units";
import type { BundleVisualization } from "@/lib/visualizations";
import { VariableRow } from "./VariableRow";
import { VisualizationView } from "./Visualization";
import { makeVizValues, type VizValues } from "./viz-values";

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
  ranges,
  order,
  visualizations,
  initialLocked,
  onLocks,
  shownUnits: chosenUnits,
  onShownUnits,
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
  /** The values each variable should stay within, by name: a warning outside them, a slider between them. */
  ranges?: Record<string, Range>;
  /** The order variables are listed in, by name. */
  order?: string[];
  /** Drawings that follow the variables: the board's own come first, those of used boards go with their board. */
  visualizations?: BundleVisualization[];
  /** Starts with these variables locked instead of working it out from the values (a loaded scenario). */
  initialLocked?: string[];
  /** Told which variables are locked, each time that changes through an edit. */
  onLocks?: (locked: string[]) => void;
  /** The unit each variable is shown in, when the caller keeps track of it (so it can show the same units elsewhere). */
  shownUnits?: Record<string, string>;
  onShownUnits?: (units: Record<string, string>) => void;
}) {
  // Locked variables, in the order they were locked. A variable that has a value when the board
  // loads starts locked, so it is kept; values the formulas leave no room for are left unlocked.
  const [locked, setLocked] = useState<string[]>(() => initialLocked ?? initialLocks(analysis, values));
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
  const shown = useMemo(() => shownValues(display, plan.held, decimals), [display, decimals, plan]);

  // Recalculated values briefly flash in the accent color so the change is noticed.
  // A variable can be shown in another unit of the same kind (cm for m). Only what is shown changes: the
  // board is worked out in the unit each variable was written in.
  const [ownUnits, setOwnUnits] = useState<Record<string, string>>({});
  const shownUnits = chosenUnits ?? ownUnits;
  const unitOptions = useMemo(
    () => Object.fromEntries(analysis.variables.flatMap((v) => { const alt = alternatives(units?.[v.name]); return alt.length > 1 ? [[v.name, alt] as const] : []; })),
    [analysis, units],
  );
  const changeUnit = useCallback(
    (name: string, unit: string) => (onShownUnits ? onShownUnits({ ...shownUnits, [name]: unit }) : setOwnUnits((s) => ({ ...s, [name]: unit }))),
    [onShownUnits, shownUnits],
  );

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
  const latest = useRef({ analysis, locked, display, onChange, onLocks, labels });
  useLayoutEffect(() => {
    latest.current = { analysis, locked, display, onChange, onLocks, labels };
  });

  const apply = useCallback(
    (nextLocked: string[], nextValues: Record<string, string>, edited?: { name: string; text: string }) => {
      const { analysis, display, onChange, onLocks, labels } = latest.current;
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
      onLocks?.(lockedNow);
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

  // Moves the focus to a variable's field, for the charts that can be clicked.
  const focusField = useCallback((name: string) => {
    const field = inputs.current.get(name);
    if (!field) return;
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    field.focus({ preventScroll: true });
  }, []);

  if (analysis.variables.length === 0) {
    return <p className="text-ink-muted">Variables from your formulas show up here.</p>;
  }
  if (!revealHidden && analysis.variables.every((v) => hidden?.[v.name] === true)) {
    return <p className="text-ink-muted">Every variable on this board is hidden.</p>;
  }

  // This board's own variables first, then the variables of each board in use under its title.
  const sections = sectionsByBoard(analysis.variables, groups ?? {}, order);

  // What the drawings and charts read from the board.
  const vizValues: VizValues = {
    ...makeVizValues({ analysis, display, shown, units, labels, groups, locked, ranges }),
    focus: focusField,
    // Written with four significant digits, like a number someone would type.
    setValue: (name, value) => edit(name, String(Number(value.toPrecision(4)))),
  };
  const drawingsOf = (group: string | null) =>
    (visualizations ?? [])
      .filter((viz) => (viz.group ?? null) === group)
      .map((viz, i) => <VisualizationView key={`${group}-${i}`} viz={viz} values={vizValues} />);

  // By what the number written in the variable's own unit is multiplied to be shown in the unit chosen for it.
  const ratioOf = (name: string): number => {
    const chosen = shownUnits[name];
    return chosen && unitOptions[name] ? (unitRatio(units?.[name], chosen) ?? 1) : 1;
  };
  // The value as shown, in the chosen unit. What was typed is kept as typed while it is being edited (in the row).
  const valueOf = (name: string, text: string | undefined): string => {
    const r = ratioOf(name);
    const n = parseValue(text);
    if (r === 1 || n === undefined) return text ?? "";
    const places = decimals?.[name];
    return places !== undefined && !plan.held.includes(name) ? formatDecimals(n * r, places) : formatNumber(n * r);
  };

  function row(v: { name: string }, group: string | null) {
    const isHidden = hidden?.[v.name] === true;
    if (isHidden && !revealHidden) return null;
    const problem = rejected?.name === v.name ? rejected : null;
    return (
      <VariableRow
        key={v.name}
        name={v.name}
        description={descriptions?.[v.name]}
        unit={shownUnits[v.name] && unitOptions[v.name] ? shownUnits[v.name] : units?.[v.name]}
        unitOptions={unitOptions[v.name]}
        ratio={ratioOf(v.name)}
        onUnit={changeUnit}
        // A variable from a board in use is shown without the board''s alias, under that board''s heading.
        label={labels?.[v.name] || (group ? displayName(v.name.slice(group.length + 1)) : undefined)}
        hidden={isHidden}
        linkedTo={links?.[v.name] ? displayName(links[v.name]) : undefined}
        value={valueOf(v.name, problem ? problem.text : draft?.name === v.name ? draft.text : shown[v.name])}
        problem={problem?.reason ?? null}
        canLock={parseValue(display[v.name]) !== undefined}
        readOnly={decided.has(v.name) && !problem}
        locked={locked.includes(v.name)}
        onEdit={edit}
        onToggleLock={toggleLock}
        onBlur={endDraft}
        register={register}
        range={ranges?.[v.name]}
        current={parseValue(display[v.name])}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        const rows = section.variables.map((v) => row(v, section.key)).filter(Boolean);
        if (rows.length === 0) return null;
        return (
          <div key={section.key ?? "own"} className={`flex flex-col gap-4 ${sections.length > 1 ? "group-box" : ""}`}>
            {section.key && groups?.[section.key] && (
              <h3 className="group-title">
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
            {drawingsOf(section.key)}
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
