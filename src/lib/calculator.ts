import { brokenFormulas, formatDecimals, formatNumber, parseValue, planSolve, solve, type Analysis } from "./formulas";

// What a board shows for a set of typed values and locks. Pure, so the panel, the charts and the tests can
// all ask the same question.

// Solves the board with these values held where they are locked. `display` is every variable as text: the
// kept values as they were typed, the rest calculated.
export function compute(analysis: Analysis, values: Record<string, string>, locked: string[]) {
  const plan = planSolve(analysis, locked);
  const numbers = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseValue(v)]));
  const result = solve(plan, numbers, numbers);
  // Values being kept show their exact text; everything else shows the calculated number.
  const display: Record<string, string> = {};
  for (const v of analysis.variables) {
    display[v.name] = plan.held.includes(v.name) ? (values[v.name] ?? "") : formatNumber(result.values[v.name]);
  }
  return { plan, result, display, broken: brokenFormulas(analysis, plan, result.values) };
}

// The variables that start out locked: those with a starting value, inputs before results, as far as
// the formulas allow every one of them to be kept at once.
export function initialLocks(analysis: Analysis, values: Record<string, string>): string[] {
  const defined = new Set(analysis.formulas.filter((f) => !f.error).map((f) => f.name));
  const valued = analysis.variables.map((v) => v.name).filter((name) => parseValue(values[name] ?? "") !== undefined);
  const ordered = [...valued.filter((n) => !defined.has(n)), ...valued.filter((n) => defined.has(n))];
  const held = planSolve(analysis, ordered).held;
  return ordered.filter((n) => held.includes(n));
}

export type Computed = ReturnType<typeof compute>;

// What is shown for the values: `display` keeps full precision (it is fed back into the next solve), so the
// rounding the board asks for is only applied here, to calculated values. Values that were typed show as typed.
export function shownValues(display: Record<string, string>, held: string[], decimals?: Record<string, number>): Record<string, string> {
  if (!decimals) return display;
  const out = { ...display };
  for (const [name, places] of Object.entries(decimals)) {
    const n = parseValue(display[name]);
    if (n !== undefined && !held.includes(name)) out[name] = formatDecimals(n, places);
  }
  return out;
}
