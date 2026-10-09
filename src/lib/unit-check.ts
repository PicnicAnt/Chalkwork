import { parse, type MathNode } from "mathjs";
import type { Analysis } from "./formulas";
import { describeDim, parseUnit, sameDim, type Dim } from "./units";

// Checks that the formulas fit the units the variables were given: that only like is added to like, and that the
// right side of a formula comes out in the unit its left side is written in. A formula in which a variable
// has no unit (or one that isn't known here) is left alone, so the check only speaks when it is sure.
//
// It looks at each formula's expression as a quantity: a plain number (which fits any unit, since 2 * price and
// price + 5 both make sense), a known unit (dimension and size next to the base unit) or unknown.

type Q = { kind: "any" } | { kind: "unknown" } | { kind: "known"; dim: Dim; factor: number };
const ANY: Q = { kind: "any" };
const UNKNOWN: Q = { kind: "unknown" };

export type UnitProblem = { line: number; formula: string; message: string };

const close = (a: number, b: number) => Math.abs(a / b - 1) < 1e-9;
const fmt = (n: number) => Number(n.toPrecision(6)).toLocaleString("en-US");

// What an expression is, in units. Problems met on the way (a sum of unlike things) are added to `found`.
function quantity(node: MathNode, unitOf: (name: string) => Q, found: string[]): Q {
  const n = node as MathNode & { op?: string; fn?: { name?: string } | string; args?: MathNode[]; content?: MathNode; name?: string; value?: unknown };
  switch (node.type) {
    case "ConstantNode":
      return ANY;
    case "SymbolNode":
      return unitOf(n.name as string);
    case "ParenthesisNode":
      return quantity(n.content as MathNode, unitOf, found);
    case "OperatorNode": {
      const args = (n.args ?? []).map((a) => quantity(a, unitOf, found));
      if (args.length === 1) return n.op === "-" || n.op === "+" ? args[0] : UNKNOWN;
      const [a, b] = args;
      if (n.op === "+" || n.op === "-") return unify(a, b, found);
      if (n.op === "*" || n.op === "/") {
        if (a.kind === "unknown" || b.kind === "unknown") return UNKNOWN;
        // A plain number multiplies or divides without changing the unit, except 1 / x, which inverts x.
        if (a.kind === "any") return n.op === "/" && b.kind === "known" ? invert(b) : b;
        if (b.kind === "any") return a;
        const sign = n.op === "*" ? 1 : -1;
        return { kind: "known", dim: combine(a.dim, b.dim, sign), factor: a.factor * b.factor ** sign };
      }
      if (n.op === "^") {
        const exponent = (n.args as MathNode[])[1];
        const power = exponent.type === "ConstantNode" ? Number((exponent as MathNode & { value: unknown }).value) : NaN;
        if (a.kind !== "known") return a;
        return Number.isFinite(power) ? raise(a, power) : UNKNOWN;
      }
      return UNKNOWN;
    }
    case "FunctionNode": {
      const name = typeof n.fn === "string" ? n.fn : n.fn?.name;
      const args = (n.args ?? []).map((a) => quantity(a, unitOf, found));
      if (name === "sqrt" && args.length === 1) return args[0].kind === "known" ? raise(args[0], 0.5) : args[0];
      if (name === "cbrt" && args.length === 1) return args[0].kind === "known" ? raise(args[0], 1 / 3) : args[0];
      if (["abs", "round", "floor", "ceil", "fix"].includes(name ?? "") && args.length >= 1) return args[0];
      if (["min", "max", "mean", "median", "sum", "hypot"].includes(name ?? "") && args.length >= 1) return args.reduce((x, y) => unify(x, y, found));
      if (["sin", "cos", "tan", "asin", "acos", "atan", "exp", "log", "log10", "log2", "sign"].includes(name ?? "")) return ANY;
      return UNKNOWN;
    }
    default:
      return UNKNOWN;
  }
}

function combine(a: Dim, b: Dim, sign: 1 | -1): Dim {
  const out: Dim = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + sign * v;
    if (out[k] === 0) delete out[k];
  }
  return out;
}
const raise = (q: Q & { kind: "known" }, power: number): Q => ({
  kind: "known",
  dim: Object.fromEntries(Object.entries(q.dim).map(([k, v]) => [k, v * power])),
  factor: q.factor ** power,
});
const invert = (q: Q & { kind: "known" }): Q => raise(q, -1);

// Things added (or compared, or taken the smaller of) must be of the same kind and size.
function unify(a: Q, b: Q, found: string[]): Q {
  if (a.kind === "unknown" || b.kind === "unknown") return UNKNOWN;
  if (a.kind === "any") return b;
  if (b.kind === "any") return a;
  if (!sameDim(a.dim, b.dim)) found.push(`adds ${describeDim(a.dim)} to ${describeDim(b.dim)}`);
  else if (!close(a.factor, b.factor)) found.push(`adds quantities of the same kind in different units (one is ${fmt(a.factor / b.factor)} times the other)`);
  return a;
}

export function checkUnits(analysis: Analysis, units: Record<string, string>): UnitProblem[] {
  const unitOf = (name: string): Q => {
    const known = parseUnit(units[name]);
    // Constants such as pi and e are plain numbers; a variable without a (known) unit is unknown.
    if (known) return { kind: "known", dim: known.dim, factor: known.factor };
    return name === "pi" || name === "e" || name === "tau" || name === "phi" ? ANY : UNKNOWN;
  };

  const problems: UnitProblem[] = [];
  for (const f of analysis.formulas) {
    if (f.error) continue;
    let tree: MathNode;
    try {
      tree = parse(f.text);
    } catch {
      continue;
    }
    // "name = expression": the right side is what is checked, against the unit of the name.
    const value = (tree as MathNode & { value?: MathNode }).value;
    if (tree.type !== "AssignmentNode" || !value) continue;

    const found: string[] = [];
    const right = quantity(value, unitOf, found);
    const left = unitOf(f.name);
    for (const what of found) problems.push({ line: f.line, formula: f.text, message: `This ${what}.` });
    if (found.length > 0 || left.kind !== "known" || right.kind !== "known") continue;

    if (!sameDim(left.dim, right.dim)) {
      problems.push({ line: f.line, formula: f.text, message: `The right side works out in ${describeDim(right.dim)}, but ${f.name} is in ${describeDim(left.dim)}.` });
    } else if (!close(left.factor, right.factor)) {
      const by = right.factor / left.factor;
      problems.push({
        line: f.line,
        formula: f.text,
        message: `${f.name} is in a different unit than the right side gives (same kind, but the right side is ${fmt(by)} times larger): the numbers will be off by that factor.`,
      });
    }
  }
  return problems;
}
