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
const format = math.format.bind(math);

// Formulas come from other users, so disable the functions that can define or change things.
// parse/format above are captured first, so only formulas lose access to these.
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

// Symbols that mean something on their own and so never become inputs.
const CONSTANTS = new Set(["pi", "e", "tau", "phi", "i", "true", "false", "null", "Infinity", "NaN", "PI", "E"]);

export type Formula = {
  line: number; // 1-based position among the formulas
  text: string;
  name: string;
  label: string;
  deps: string[]; // symbols the expression uses (inputs or other formulas)
  error?: string;
  compiled?: EvalFunction;
};

export type Analysis = {
  formulas: Formula[];
  inputs: { name: string; label: string }[];
};

export type FormulaResult = {
  name: string;
  label: string;
  text: string;
  value?: string;
  raw?: unknown;
  error?: string;
  missing?: string[]; // set when the error is only that some values aren't filled in
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

function symbolsUsed(node: MathNode): string[] {
  const names: string[] = [];
  node.traverse((n, path, parent) => {
    if (!isSymbolNode(n)) return;
    // Skip the name of a called function, e.g. "sqrt" in sqrt(x).
    if (parent && isFunctionNode(parent) && path === "fn") return;
    if (!names.includes(n.name)) names.push(n.name);
  });
  return names;
}

// Each formula is "name = expression" (or just an expression, which gets a generated name).
// Inputs are every symbol used by a formula that no formula defines.
export function analyzeFormulas(lines: string[]): Analysis {
  const formulas: Formula[] = lines.map((text, i) => {
    const base = { line: i + 1, text, name: `result_${i + 1}`, label: `Result ${i + 1}`, deps: [] };
    let node: MathNode;
    try {
      node = parse(text);
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "Could not read formula" };
    }

    let expression = node;
    if (isAssignmentNode(node)) {
      if (!isSymbolNode(node.object) || node.index) return { ...base, error: "Left side must be a plain name" };
      expression = node.value;
      Object.assign(base, { name: node.object.name, label: humanize(node.object.name) });
    }

    let nested = false;
    expression.traverse((n) => {
      if (isAssignmentNode(n) || isFunctionAssignmentNode(n)) nested = true;
    });
    if (nested || isFunctionAssignmentNode(node)) return { ...base, error: "Only one name = expression per line" };
    if (CONSTANTS.has(base.name)) return { ...base, error: `"${base.name}" is a built-in constant` };

    try {
      return { ...base, deps: symbolsUsed(expression), compiled: expression.compile() };
    } catch (e) {
      return { ...base, error: e instanceof Error ? e.message : "Could not read formula" };
    }
  });

  const seen = new Set<string>();
  for (const f of formulas) {
    if (f.error) continue;
    if (seen.has(f.name)) f.error = `"${f.name}" is defined more than once`;
    seen.add(f.name);
  }

  const defined = new Set(formulas.map((f) => f.name));
  const inputs: Analysis["inputs"] = [];
  for (const f of formulas) {
    for (const dep of f.deps) {
      if (defined.has(dep) || CONSTANTS.has(dep) || inputs.some((x) => x.name === dep)) continue;
      // A bare word that mathjs already knows as a function (e.g. "sqrt") is not an input.
      if (typeof (math as unknown as Record<string, unknown>)[dep] === "function") continue;
      inputs.push({ name: dep, label: humanize(dep) });
    }
  }

  return { formulas, inputs };
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    // Small numbers keep significant digits (0.00375), larger ones get up to 4 decimals.
    return Math.abs(value) < 1
      ? value.toLocaleString("en-US", { maximumSignificantDigits: 6 })
      : value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return format(value, { precision: 10 });
}

export function parseInputValue(value: string | undefined): unknown {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return undefined;
  const num = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(num) ? num : trimmed;
}

// A number written back into an input field: no float noise, no thousands separators.
export function formatForInput(value: number): string {
  return String(Number(value.toPrecision(10)));
}

// Evaluates every formula, in dependency order, against the given input values.
// Results are returned in the order the formulas were written.
export function evaluateFormulas(analysis: Analysis, values: Record<string, string>): FormulaResult[] {
  const scope = new Map<string, unknown>();
  for (const input of analysis.inputs) {
    const v = parseInputValue(values[input.name]);
    if (v !== undefined) scope.set(input.name, v);
  }
  return computeAll(analysis, scope);
}

function computeAll(analysis: Analysis, scope: Map<string, unknown>): FormulaResult[] {
  const byName = new Map(analysis.formulas.filter((f) => !f.error).map((f) => [f.name, f]));
  const results = new Map<Formula, FormulaResult>();

  function dependsOn(from: string, target: string, seen = new Set<string>()): boolean {
    for (const dep of byName.get(from)?.deps ?? []) {
      if (dep === target) return true;
      if (byName.has(dep) && !seen.has(dep)) {
        seen.add(dep);
        if (dependsOn(dep, target, seen)) return true;
      }
    }
    return false;
  }

  function run(f: Formula): FormulaResult {
    const done = results.get(f);
    if (done) return done;
    const base = { name: f.name, label: f.label, text: f.text };
    if (f.error || !f.compiled) return finish(f, { ...base, error: f.error });
    if (dependsOn(f.name, f.name)) return finish(f, { ...base, error: "Refers back to itself through other formulas" });

    // Collect what this formula is waiting for, naming the empty inputs rather than
    // the intermediate formulas when that's the reason.
    const waiting = new Set<string>();
    for (const dep of f.deps) {
      const upstream = byName.get(dep);
      if (upstream) {
        const r = run(upstream);
        if (r.missing) r.missing.forEach((m) => waiting.add(m));
        else if (r.error) waiting.add(dep);
      } else if (analysis.inputs.some((x) => x.name === dep) && !scope.has(dep)) {
        waiting.add(dep);
      }
    }

    if (waiting.size) {
      const missing = [...waiting];
      return finish(f, { ...base, error: `Needs ${missing.join(", ")}`, missing });
    }
    try {
      const raw = f.compiled.evaluate(new Map(scope));
      if (typeof raw === "function") throw new Error("Formula must produce a value");
      scope.set(f.name, raw);
      return finish(f, { ...base, value: formatValue(raw), raw });
    } catch (e) {
      return finish(f, { ...base, error: e instanceof Error ? e.message : "Could not calculate" });
    }
  }

  function finish(f: Formula, r: FormulaResult) {
    results.set(f, r);
    return r;
  }

  return analysis.formulas.map(run);
}

// The inputs a formula depends on, directly or through other formulas, in the order they're used.
export function inputsBehind(analysis: Analysis, name: string): string[] {
  const inputNames = new Set(analysis.inputs.map((i) => i.name));
  const byName = new Map(analysis.formulas.filter((f) => !f.error).map((f) => [f.name, f]));
  const found: string[] = [];
  const seen = new Set<string>();
  (function walk(n: string) {
    for (const dep of byName.get(n)?.deps ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      if (inputNames.has(dep)) found.push(dep);
      else walk(dep);
    }
  })(name);
  return found;
}

// Works backwards: finds the value of `unknown` that makes formula `target` equal `goal`,
// keeping every other input as it is. Returns null when no such value can be found.
export function solveForInput(
  analysis: Analysis,
  values: Record<string, string>,
  target: string,
  goal: number,
  unknown: string,
): number | null {
  const scope = new Map<string, unknown>();
  for (const input of analysis.inputs) {
    const v = parseInputValue(values[input.name]);
    if (v !== undefined) scope.set(input.name, v);
  }
  const index = analysis.formulas.findIndex((f) => f.name === target);
  if (index < 0) return null;

  const g = (x: number) => {
    const s = new Map(scope);
    s.set(unknown, x);
    const raw = computeAll(analysis, s)[index].raw;
    return typeof raw === "number" ? raw - goal : NaN;
  };
  const tolerance = 1e-9 * Math.max(1, Math.abs(goal));
  const current = scope.get(unknown);
  const start = typeof current === "number" && current !== 0 ? current : 1;

  // Secant method from the current value: fast, and finds the nearest solution.
  let x0 = start;
  let x1 = start * 1.01 + 0.01;
  let f0 = g(x0);
  let f1 = g(x1);
  for (let i = 0; i < 100 && Number.isFinite(f0) && Number.isFinite(f1); i++) {
    if (Math.abs(f1) <= tolerance) return x1;
    if (f1 === f0) break;
    const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
    if (!Number.isFinite(x2)) break;
    [x0, f0, x1, f1] = [x1, f1, x2, g(x2)];
  }

  // Fall back to scanning for a sign change, nearest the current value first, then bisecting.
  const samples = new Set<number>([start]);
  for (let k = -6; k <= 12; k++) {
    samples.add(10 ** k).add(-(10 ** k));
    samples.add(start + Math.abs(start) * 10 ** (k / 2)).add(start - Math.abs(start) * 10 ** (k / 2));
  }
  const xs = [...samples].sort((a, b) => a - b);
  const fs = xs.map(g);
  const brackets: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
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
    if (Math.abs(g(mid)) <= 1e-6 * Math.max(1, Math.abs(goal))) return mid;
  }
  return null;
}

