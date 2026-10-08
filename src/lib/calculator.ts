import { brokenFormulas, formatNumber, parseValue, planSolve, solve, type Analysis } from "./formulas";

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
