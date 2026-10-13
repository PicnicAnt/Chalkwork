import { groupOf, type Range } from "@/lib/boards";
import { displayName, parseValue, planSolve, solve, type Analysis } from "@/lib/formulas";

// What a drawing or chart can ask the board it is on. Shapes only need `number` and `text`; the
// charts also re-solve the board with other values (`evaluate`).
export type VizValues = {
  /** The number a variable currently has, or undefined if it has none yet. */
  number: (name: string) => number | undefined;
  /** How to write it, with decimals and unit, as shown on the board. */
  text: (name: string) => string;
  /** What the board calls the variable (its display name, or its name). */
  name: (name: string) => string;
  /** The name with the board it comes from in front, when it comes from a used board (for lists of several). */
  fullName: (name: string) => string;
  /** Its unit, or an empty string. */
  unit: (name: string) => string;
  /** True when the variable is locked (kept at the value typed). */
  isLocked: (name: string) => boolean;
  /** The values the variable should stay within, if the creator set any. */
  range: (name: string) => Range | undefined;
  /**
   * What each board in a collection adds to one of its totals (parts.weight): the board's name and its value
   * times its Included switch. Empty when the variable is not a total of a collection.
   */
  contributors: (total: string) => { name: string; value: number }[];
  /** The variables the user has typed values for, which are the board's inputs. */
  inputs: () => string[];
  /**
   * Solves the board again with these variables held at the given numbers (everything else keeps its
   * lock) and returns every variable's number, or null if that can't be solved.
   */
  evaluate: (overrides: Record<string, number>) => Record<string, number> | null;
  /** Sets the variable to this number, as if it had been typed (so it is locked at that value). */
  setValue: (name: string, value: number) => void;
  /** Moves the focus to the variable's field on the board, scrolling it into view. Does nothing if it isn't shown. */
  focus: (name: string) => void;
  /** The board's equations: what each variable is worked out from. */
  formulas: () => { name: string; vars: string[] }[];
  /** Changes whenever anything a chart depends on changes, so a chart can compute only then. */
  signature: string;
};

// What the drawings and charts of a board read: the numbers as they are right now, how to write them, and a
// way to solve the board again with other values. `display` has every variable's number as text and `shown`
// the same rounded as the board shows it.
export function makeVizValues({
  analysis,
  display,
  shown,
  units,
  labels,
  groups,
  locked,
  ranges,
}: {
  analysis: Analysis;
  display: Record<string, string>;
  shown: Record<string, string>;
  units?: Record<string, string>;
  labels?: Record<string, string>;
  groups?: Record<string, { title: string; board: string; collection?: string }>;
  locked: string[];
  ranges?: Record<string, Range>;
}): Omit<VizValues, "focus" | "setValue"> {
  // A variable of a used board without the board's alias in front.
  const plans = new Map<string, ReturnType<typeof planSolve>>();
  const base: Record<string, number | undefined> = Object.fromEntries(Object.entries(display).map(([k, v]) => [k, parseValue(v)]));
  const local = (name: string) => labels?.[name] || displayName(groupOf(name) ? name.slice(name.indexOf("$") + 1) : name);
  return {
    number: (name) => parseValue(display[name]),
    text: (name) => {
      const unit = units?.[name];
      return `${shown[name] ?? ""}${unit ? " " + unit : ""}`;
    },
    name: local,
    fullName: (name) => {
      const group = groupOf(name);
      return group && groups?.[group] ? `${groups[group].title}: ${local(name)}` : local(name);
    },
    unit: (name) => units?.[name] ?? "",
    isLocked: (name) => locked.includes(name),
    range: (name) => ranges?.[name],
    contributors: (total) => {
      const at = total.indexOf("$");
      if (at < 0) return [];
      const collection = total.slice(0, at);
      const stat = total.slice(at + 1);
      return Object.entries(groups ?? {})
        .filter(([, g]) => g.collection === collection)
        .flatMap(([alias, g]) => {
          const value = parseValue(display[`${alias}$${stat}`]);
          if (value === undefined) return [];
          const on = parseValue(display[`${alias}$equipped`]) ?? 1;
          return [{ name: g.title, value: value * on }];
        });
    },
    inputs: () => locked.filter((n) => parseValue(display[n]) !== undefined),
    // The board solved again with some variables held at other numbers, as if they had been typed.
    evaluate: (overrides) => {
      const names = Object.keys(overrides);
      try {
        // A chart asks for the same held variables again and again with other numbers: the plan is made once per
        // set of them, and the typed numbers are only read once.
        const key = names.join("|");
        let plan = plans.get(key);
        if (!plan) {
          plan = planSolve(analysis, [...names, ...locked.filter((n) => !names.includes(n))]);
          plans.set(key, plan);
        }
        const numbers = { ...base, ...overrides };
        const solved = solve(plan, numbers, numbers);
        const out: Record<string, number> = {};
        for (const [name, value] of Object.entries(solved.values)) {
          if (value !== undefined && Number.isFinite(value)) out[name] = value;
        }
        return out;
      } catch {
        return null;
      }
    },
    formulas: () => analysis.formulas.filter((f) => !f.error).map((f) => ({ name: f.name, vars: f.vars })),
    // What the charts depend on: the numbers and the locks.
    signature: JSON.stringify([display, locked]),
  };
}
