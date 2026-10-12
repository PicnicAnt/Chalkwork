import { displayName, formatNumber, parseValue, tokenize, type Analysis, type Formula, type Plan } from "./formulas";

// "Show working": how a value on the board came to be. For a result it is the equation it came from with the numbers
// put in, and in turn how each of those numbers was worked out; for a value somebody typed it says so. This only
// reads what the solver already decided (the plan), so it never disagrees with the numbers on screen.

export type Working = {
  name: string;
  /** The value as shown. */
  value: string;
  how: "set" | "formula" | "backwards" | "search" | "none";
  /** The equation as written, when there is one. */
  formula?: string;
  /** The equation with the numbers put in. */
  numbers?: string;
  inputs: Working[];
  /** More to say, such as that the value was found by trying values. */
  note?: string;
};

type Origin = { formula: Formula; unknown: string } | { search: Formula; tear: string };

// Which equation produced each variable, from the plan's steps (including the steps inside a search).
function origins(plan: Plan): Map<string, Origin> {
  const out = new Map<string, Origin>();
  const walk = (steps: Plan["steps"]) => {
    for (const step of steps) {
      if (step.kind === "direct") out.set(step.unknown, { formula: step.formula, unknown: step.unknown });
      else {
        out.set(step.tear, { search: step.check, tear: step.tear });
        walk(step.steps);
      }
    }
  };
  walk(plan.steps);
  return out;
}

// The equation text with each variable replaced by the number it has.
function withNumbers(text: string, shown: Record<string, string>): string {
  return tokenize(text)
    .map((t) => {
      if (t.kind !== "variable") return t.text;
      const n = parseValue(shown[t.text]);
      return n === undefined ? t.text : formatNumber(n);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_DEPTH = 4;

export function explain(analysis: Analysis, plan: Plan, shown: Record<string, string>, name: string): Working {
  void analysis;
  const from = origins(plan);
  const build = (variable: string, depth: number, path: readonly string[]): Working => {
    const value = shown[variable] ?? "";
    if (plan.held.includes(variable)) return { name: variable, value, how: "set", inputs: [] };
    const origin = from.get(variable);
    if (!origin) return { name: variable, value, how: "none", inputs: [], note: value ? undefined : "Nothing decides this yet." };

    const inputsOf = (formula: Formula) =>
      depth >= MAX_DEPTH
        ? []
        : formula.vars.filter((v) => v !== variable && !path.includes(v)).map((v) => build(v, depth + 1, [...path, variable]));

    if ("search" in origin) {
      const check = origin.search;
      return {
        name: variable,
        value,
        how: "search",
        formula: check.text,
        numbers: withNumbers(check.text, shown),
        inputs: inputsOf(check),
        note: "The formulas depend on each other in a circle, so this was found by trying values until the equation below held.",
      };
    }
    const { formula } = origin;
    const forward = origin.unknown === formula.name && !formula.selfReferencing;
    const equals = formula.text.indexOf("=");
    const right = equals >= 0 ? formula.text.slice(equals + 1) : formula.text;
    return {
      name: variable,
      value,
      how: forward ? "formula" : "backwards",
      formula: formula.text,
      numbers: forward ? withNumbers(right, shown) : withNumbers(formula.text, shown),
      inputs: inputsOf(formula),
      note: forward ? undefined : "Worked backwards: the other values and the equation below decide this one.",
    };
  };
  return build(name, 0, []);
}

/** The name as people see it, using the board's display names. */
export const workingName = (name: string, labels: Record<string, string> | undefined) => labels?.[name] || displayName(name);
