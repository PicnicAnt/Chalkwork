import {
  all,
  create,
  isAssignmentNode,
  isFunctionAssignmentNode,
  isFunctionNode,
  isSymbolNode,
  type EvalFunction,
  type MathNode,
} from "mathjs";

const math = create(all);
const parse = math.parse.bind(math);

// Formulas come from other users, so disable the functions that can define or change things.
// parse above is captured first, so only formulas lose access to these.
const disabled = ["import", "createUnit", "reviver", "evaluate", "parse", "simplify", "derivative", "resolve", "compile"];
math.import(
  Object.fromEntries(
    disabled.map((name) => [
      name,
      () => {
        throw new Error(`${name} is not allowed`);
      },
    ]),
  ),
  { override: true },
);

// Symbols that mean something on their own and so never become variables.
const CONSTANTS = new Set(["pi", "e", "tau", "phi", "i", "true", "false", "null", "Infinity", "NaN", "PI", "E"]);

// Each formula is an equation, "name = expression", that must hold between its variables.
export type Formula = {
  line: number; // 1-based position among the formulas
  text: string;
  name: string; // the variable on the left side
  vars: string[]; // every variable in the equation, left side first
  selfReferencing?: boolean; // the left-side variable also appears on the right
  error?: string;
  compiled?: EvalFunction; // the right side
};

export type Variable = { name: string; label: string; formula?: string };

export type Analysis = {
  formulas: Formula[];
  variables: Variable[]; // in order of first appearance
};

// "monthly_payment" -> "Monthly payment", "loanAmount" -> "Loan amount"
export function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isVariableName(name: string) {
  // A bare word mathjs already knows as a function (e.g. "sqrt") is not a variable.
  return !CONSTANTS.has(name) && typeof (math as unknown as Record<string, unknown>)[name] !== "function";
}

function symbolsUsed(node: MathNode): string[] {
  const names: string[] = [];
  node.traverse((n, path, parent) => {
    if (!isSymbolNode(n)) return;
    // Skip the name of a called function, e.g. "sqrt" in sqrt(x).
    if (parent && isFunctionNode(parent) && path === "fn") return;
    if (!names.includes(n.name) && isVariableName(n.name)) names.push(n.name);
  });
  return names;
}

export function analyzeFormulas(lines: string[]): Analysis {
  const formulas: Formula[] = lines.map((text, i) => {
    const base = { line: i + 1, text, name: `result_${i + 1}`, vars: [] as string[] };
    let node: MathNode;
    try {
      node = parse(text);
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "Could not read formula" };
    }

    // A line without "name =" still gets a variable, so its value can be shown.
    let expression = node;
    if (isAssignmentNode(node)) {
      if (!isSymbolNode(node.object) || node.index) return { ...base, error: "Left side must be a plain name" };
      expression = node.value;
      base.name = node.object.name;
    }

    let nested = false;
    expression.traverse((n) => {
      if (isAssignmentNode(n) || isFunctionAssignmentNode(n)) nested = true;
    });
    if (nested || isFunctionAssignmentNode(node)) return { ...base, error: "Only one name = expression per line" };
    if (!isVariableName(base.name)) return { ...base, error: `"${base.name}" is a built-in name` };

    try {
      const used = symbolsUsed(expression);
      const vars = [base.name, ...used.filter((v) => v !== base.name)];
      return { ...base, vars, selfReferencing: used.includes(base.name), compiled: expression.compile() };
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "Could not read formula" };
    }
  });

  const variables: Variable[] = [];
  for (const f of formulas) {
    for (const name of f.vars) {
      if (!variables.some((v) => v.name === name)) variables.push({ name, label: humanize(name) });
    }
  }
  for (const f of formulas) {
    const v = variables.find((x) => x.name === f.name);
    if (v && !f.error && !v.formula) v.formula = f.text;
  }
  return { formulas, variables };
}

// ---------------------------------------------------------------------------
// Solving
//
// With N variables and E equations, N - E values must be given and the rest follow.
// Which ones are given is decided by recency: the variables the user edited most
// recently are kept as they are, and everything else is recalculated to fit.

// A direct step: an equation with one unknown left, solved for it.
// A tear step: a group of equations that only fit together (e.g. a payment that depends on the
// loan, while the loan depends on the interest that depends on the payment). One variable in the
// group is guessed, the rest follow from it, and the guess is refined until a leftover equation holds.
type Step =
  | { kind: "direct"; formula: Formula; unknown: string }
  | { kind: "tear"; tear: string; steps: Step[]; check: Formula };
export type Plan = { held: string[]; steps: Step[] };

function stepVariables(step: Step): string[] {
  return step.kind === "direct" ? [step.unknown] : [step.tear, ...step.steps.flatMap(stepVariables)];
}

function stepFormulas(step: Step): Formula[] {
  return step.kind === "direct" ? [step.formula] : [step.check, ...step.steps.flatMap(stepFormulas)];
}

// Repeatedly solves any equation with exactly one unknown left. Returns the steps and
// any equations left with no unknowns (which then only need to hold).
function propagateDirect(equations: Formula[], known: Set<string>, used: Set<Formula>) {
  const steps: Step[] = [];
  const checks: Formula[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const f of equations) {
      if (used.has(f)) continue;
      const unknowns = f.vars.filter((v) => !known.has(v));
      if (unknowns.length === 1) {
        steps.push({ kind: "direct", formula: f, unknown: unknowns[0] });
        known.add(unknowns[0]);
        used.add(f);
        progress = true;
      } else if (unknowns.length === 0) {
        used.add(f);
        checks.push(f);
      }
    }
  }
  return { steps, checks };
}

// Works out, from structure alone, which variables the held ones determine and how.
function propagate(equations: Formula[], held: Set<string>): Step[] {
  const known = new Set(held);
  const used = new Set<Formula>();
  const steps: Step[] = [...propagateDirect(equations, known, used).steps];

  // Stuck: try guessing one unknown and see whether that closes a group of equations.
  for (;;) {
    const unknownVars = [...new Set(equations.filter((f) => !used.has(f)).flatMap((f) => f.vars))].filter(
      (v) => !known.has(v),
    );
    let found = false;
    for (const tear of unknownVars) {
      const k = new Set(known).add(tear);
      const u = new Set(used);
      const inner = propagateDirect(equations, k, u);
      if (inner.checks.length === 0) continue;
      const [check] = inner.checks;
      steps.push({ kind: "tear", tear, steps: inner.steps, check });
      k.forEach((v) => known.add(v));
      u.forEach((f) => used.add(f));
      steps.push(...propagateDirect(equations, known, used).steps);
      found = true;
      break;
    }
    if (!found) return steps;
  }
}

// `recent` is most recent first. Variables nobody edited fall back to the order they
// appear, preferring ones no formula defines, so a fresh calculation behaves like
// "fill in the inputs, get the results".
export function planSolve(analysis: Analysis, recent: string[]): Plan {
  const equations = analysis.formulas.filter((f) => !f.error);
  const names = analysis.variables.map((v) => v.name);
  const defined = new Set(equations.map((f) => f.name));
  const order = [
    ...recent.filter((n) => names.includes(n)),
    ...names.filter((n) => !recent.includes(n) && !defined.has(n)),
    ...names.filter((n) => !recent.includes(n) && defined.has(n)),
  ];

  const held: string[] = [];
  let steps: Step[] = [];
  for (const name of order) {
    if (held.includes(name) || steps.some((s) => stepVariables(s).includes(name))) continue;
    held.push(name);
    steps = propagate(equations, new Set(held));
    if (held.length + steps.flatMap(stepVariables).length === names.length) break;
  }
  return { held, steps };
}

export type SolveResult = {
  values: Record<string, number | undefined>;
  failed?: string; // the variable that couldn't be made to fit
};

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return v ? 1 : 0;
  // mathjs can return BigNumber/Fraction-like objects for some functions.
  if (v && typeof v === "object" && "valueOf" in v) {
    const n = Number((v as { valueOf(): unknown }).valueOf());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

// left side minus right side of an equation, given values for all its variables.
function residualOf(formula: Formula, values: Record<string, number | undefined>): number {
  if (formula.vars.some((v) => values[v] === undefined)) return NaN;
  try {
    const rhs = toNumber(formula.compiled!.evaluate(new Map(formula.vars.map((v) => [v, values[v]]))));
    return rhs === undefined ? NaN : values[formula.name]! - rhs;
  } catch {
    return NaN;
  }
}

// Runs steps in order, filling in `values`. Returns the variable that couldn't be solved, if any.
function runSteps(steps: Step[], values: Record<string, number | undefined>, previous: Record<string, number | undefined>): string | undefined {
  for (const step of steps) {
    if (step.kind === "tear") {
      const vars = stepFormulas(step).flatMap((f) => f.vars);
      const inputs = vars.filter((v) => v !== step.tear && !stepVariables(step).includes(v));
      if (inputs.some((v) => values[v] === undefined)) {
        stepVariables(step).forEach((v) => (values[v] = undefined));
        continue;
      }
      const g = (x: number) => {
        values[step.tear] = x;
        if (runSteps(step.steps, values, previous)) return NaN;
        return residualOf(step.check, values);
      };
      const scale = Math.abs(values[step.check.name] ?? 1);
      const x = findRoot(g, previous[step.tear], scale);
      if (x === null) return step.tear;
      g(x); // leave the values from the solution in place
      continue;
    }

    const { formula, unknown } = step;
    const others = formula.vars.filter((v) => v !== unknown);
    if (others.some((v) => values[v] === undefined)) {
      values[unknown] = undefined; // waiting for a value further up
      continue;
    }
    if (unknown === formula.name && !formula.selfReferencing) {
      // The usual direction: evaluate the right side.
      try {
        values[unknown] = toNumber(formula.compiled!.evaluate(new Map(others.map((v) => [v, values[v]]))));
      } catch {
        values[unknown] = undefined;
      }
      continue;
    }
    // Backwards: find the value that makes the left side equal the right side.
    const g = (x: number) => residualOf(formula, { ...values, [unknown]: x });
    const x = findRoot(g, previous[unknown], Math.abs(values[formula.name] ?? 1));
    if (x === null) return unknown;
    values[unknown] = x;
  }
  return undefined;
}

export function solve(
  analysis: Analysis,
  plan: Plan,
  given: Record<string, number | undefined>,
  previous: Record<string, number | undefined> = {},
): SolveResult {
  const values: Record<string, number | undefined> = {};
  for (const name of plan.held) values[name] = given[name];
  const failed = runSteps(plan.steps, values, previous);
  return { values, failed };
}

// Finds x with g(x) = 0, preferring the solution nearest `guess`.
export function findRoot(g: (x: number) => number, guess: number | undefined, scale: number): number | null {
  const tolerance = 1e-9 * Math.max(1, scale);
  const start = guess !== undefined && Number.isFinite(guess) && guess !== 0 ? guess : 1;

  // Secant method from the current value: fast, and finds the nearest solution.
  let x0 = start;
  let x1 = start * 1.01 + 0.01;
  let f0 = g(x0);
  let f1 = g(x1);
  if (Math.abs(f0) <= tolerance) return x0;
  for (let i = 0; i < 100 && Number.isFinite(f0) && Number.isFinite(f1); i++) {
    if (Math.abs(f1) <= tolerance) return x1;
    if (f1 === f0) break;
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
    if (!Number.isFinite(x2)) break;
    [x0, f0, x1, f1] = [x1, f1, x2, g(x2)];
  }

  // Fall back to scanning for a sign change, nearest the current value first, then bisecting.
  const samples = new Set<number>([start, 0]);
  for (let k = -6; k <= 12; k++) {
    samples.add(10 ** k).add(-(10 ** k));
    samples.add(start + Math.abs(start) * 10 ** (k / 2)).add(start - Math.abs(start) * 10 ** (k / 2));
  }
  const xs = [...samples].sort((a, b) => a - b);
  const fs = xs.map(g);
  const brackets: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    if (fs[i] === 0) return xs[i];
    if (Number.isFinite(fs[i]) && Number.isFinite(fs[i + 1]) && Math.sign(fs[i]) !== Math.sign(fs[i + 1])) {
      brackets.push([xs[i], xs[i + 1]]);
    }
  }
  brackets.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - start) - Math.abs((b[0] + b[1]) / 2 - start));
  for (let [lo, hi] of brackets) {
    let flo = g(lo);
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fmid = g(mid);
      if (!Number.isFinite(fmid)) break;
      if (Math.abs(fmid) <= tolerance) return mid;
      if (Math.sign(fmid) === Math.sign(flo)) [lo, flo] = [mid, fmid];
      else hi = mid;
    }
    const mid = (lo + hi) / 2;
    // A sign change across a pole (like 1/x at 0) is not a solution.
    if (Math.abs(g(mid)) <= 1e-6 * Math.max(1, scale)) return mid;
  }
  return null;
}

// Equations the held values over-determine, which may not hold (e.g. a = 1 and a = 2).
export function brokenFormulas(analysis: Analysis, plan: Plan, values: Record<string, number | undefined>): Formula[] {
  const solvedWith = new Set(plan.steps.flatMap(stepFormulas));
  return analysis.formulas.filter((f) => {
    if (f.error || solvedWith.has(f) || f.vars.some((v) => values[v] === undefined)) return false;
    try {
      const rhs = toNumber(f.compiled!.evaluate(new Map(f.vars.map((v) => [v, values[v]]))));
      const lhs = values[f.name]!;
      return rhs === undefined || Math.abs(lhs - rhs) > 1e-6 * Math.max(1, Math.abs(lhs));
    } catch {
      return true;
    }
  });
}

// ---------------------------------------------------------------------------
// Text <-> numbers for the variable fields

export function parseValue(text: string | undefined): number | undefined {
  const trimmed = (text ?? "").trim().replace(/,/g, "");
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

// Calculated values are shown with up to 10 significant digits and no float noise.
export function formatNumber(value: number | undefined): string {
  if (value === undefined) return "";
  return String(Number(value.toPrecision(10)));
}
