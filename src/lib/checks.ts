// Checks on a board: a few sets of numbers the author has put in, with the results they expect. They are run again
// whenever the board is shown, so a change to the formulas that breaks one is seen straight away. Plain logic.
import { compute } from "./calculator";
import { parseValue, type Analysis } from "./formulas";

export type Check = {
  name: string;
  /** The variables that are put in (locked), by name. */
  set: Record<string, string>;
  /** The results expected, by name. */
  expect: Record<string, string>;
};

export const CHECK_LIMITS = { checks: 20, name: 60, entries: 40 };

const textMap = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, CHECK_LIMITS.entries)) {
    if (typeof v === "string" && parseValue(v) !== undefined && /^[A-Za-z_][A-Za-z0-9_$]*$/.test(k)) out[k] = v.slice(0, 40);
  }
  return out;
};

// The checks as they are kept: the ones that make sense, in a bounded size.
export function parseChecks(raw: unknown): Check[] {
  if (!Array.isArray(raw)) return [];
  const out: Check[] = [];
  for (const item of raw.slice(0, CHECK_LIMITS.checks)) {
    const r = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const name = typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ").slice(0, CHECK_LIMITS.name) : "";
    const set = textMap(r.set);
    const expect = textMap(r.expect);
    if (name && Object.keys(set).length > 0 && Object.keys(expect).length > 0) out.push({ name, set, expect });
  }
  return out;
}

export type CheckRow = { name: string; expected: string; got: string; ok: boolean };
export type CheckResult = { name: string; ok: boolean; rows: CheckRow[] };

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(a), Math.abs(b));

// Puts the check's numbers in and compares what the board works out with what was expected.
export function runCheck(analysis: Analysis, base: Record<string, string>, check: Check): CheckResult {
  const known = new Set(analysis.variables.map((v) => v.name));
  const locked = Object.keys(check.set).filter((n) => known.has(n));
  const out = compute(analysis, { ...base, ...check.set }, locked);
  const rows = Object.entries(check.expect).map(([name, expected]) => {
    if (!known.has(name)) return { name, expected, got: "(gone)", ok: false };
    const got = out.display[name] ?? "";
    const a = parseValue(got);
    const b = parseValue(expected);
    return { name, expected, got, ok: a !== undefined && b !== undefined && close(a, b) };
  });
  // A put-in variable that no longer exists makes the check meaningless.
  const missing = Object.keys(check.set).some((n) => !known.has(n));
  return { name: check.name, ok: !missing && rows.every((r) => r.ok), rows };
}
