import type { Bundle } from "./boards";
import { compute, initialLocks } from "./calculator";
import { analyzeFormulas, displayName, parseValue } from "./formulas";

// Using a board from code: give it some inputs, get everything it works out. The inputs are held where they are
// given (like numbers typed on the board), and the rest is solved from them, in whatever direction the formulas
// need, so an output can be an input too. Names are written the way they are shown (alias.variable).

export type ApiVariable = { value: number | null; unit: string; label: string; fixed: boolean };
export type ApiResult =
  | { ok: true; inputs: Record<string, number>; results: Record<string, ApiVariable> }
  | { ok: false; status: 400 | 422; error: string };

export function solveBoard(bundle: Bundle, rawInputs: Record<string, unknown>): ApiResult {
  const analysis = analyzeFormulas(bundle.formulas, bundle.tables);
  const names = analysis.variables.map((v) => v.name);
  const byShownName = new Map(names.map((n) => [displayName(n), n]));

  const inputs: Record<string, string> = {};
  const unknown: string[] = [];
  for (const [key, raw] of Object.entries(rawInputs)) {
    const name = byShownName.get(key);
    if (!name) {
      unknown.push(key);
      continue;
    }
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseValue(raw) : undefined;
    if (n === undefined || !Number.isFinite(n)) return { ok: false, status: 400, error: `"${key}" must be a number.` };
    inputs[name] = String(n);
  }
  if (unknown.length > 0) {
    return { ok: false, status: 400, error: `Unknown variable${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. The variables are: ${[...byShownName.keys()].join(", ")}.` };
  }

  // What the board starts with, then what was given. The given inputs are kept before anything else.
  const values = { ...bundle.values, ...inputs };
  const locked = [...Object.keys(inputs), ...initialLocks(analysis, values).filter((n) => !(n in inputs))];
  const out = compute(analysis, values, locked);
  // An input that could not be kept (a formula fixes it, or the other inputs already decide it) is refused
  // rather than quietly changed.
  const notKept = Object.keys(inputs).filter((n) => !out.plan.held.includes(n));
  if (notKept.length > 0) {
    return { ok: false, status: 422, error: `${notKept.map(displayName).join(", ")} can't be set: the board's formulas or the other inputs already decide ${notKept.length > 1 ? "them" : "it"}.` };
  }
  if (out.result.failed || out.broken.length > 0) {
    return { ok: false, status: 422, error: "No values fit these inputs together with the board's formulas." };
  }

  const results: Record<string, ApiVariable> = {};
  for (const name of names) {
    if (bundle.hidden[name] === true) continue;
    const n = parseValue(out.display[name]);
    results[displayName(name)] = {
      value: n === undefined ? null : n,
      unit: bundle.units[name] ?? "",
      label: bundle.labels[name] || displayName(name),
      fixed: out.plan.held.includes(name),
    };
  }
  return { ok: true, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [displayName(k), Number(v)])), results };
}
