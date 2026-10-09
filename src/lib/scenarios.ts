import { compute, shownValues } from "./calculator";
import { formatNumber, parseValue, type Analysis } from "./formulas";

// A scenario is a named set of values for a board: what is typed (and so locked) and the numbers that
// went with it. It is the user's own; nobody else sees it.
export type ScenarioSnapshot = { values: Record<string, string>; locked: string[] };
export type Scenario = { id: string; name: string } & ScenarioSnapshot;

export const SCENARIO_LIMITS = { name: 40, perBoard: 20, variables: 300, text: 50 };

// What a scenario shows on this board as it is now: the board is solved again with the values kept
// where they were locked, so a change to the board since shows up. `shown` is rounded as the board does,
// `numbers` has the full precision, for working out differences.
export type Outcome = { shown: Record<string, string>; numbers: Record<string, number | undefined> };

export function outcomeOf(analysis: Analysis, snapshot: ScenarioSnapshot, decimals?: Record<string, number>): Outcome {
  const locked = snapshot.locked.filter((name) => analysis.variables.some((v) => v.name === name));
  const out = compute(analysis, snapshot.values, locked);
  return {
    shown: shownValues(out.display, out.plan.held, decimals),
    numbers: Object.fromEntries(Object.entries(out.display).map(([name, text]) => [name, parseValue(text)])),
  };
}

export function resultsOf(analysis: Analysis, snapshot: ScenarioSnapshot, decimals?: Record<string, number>): Record<string, string> {
  return outcomeOf(analysis, snapshot, decimals).shown;
}

// How a number differs from a baseline, as the difference or as a percentage of the baseline. Returns null when
// there is nothing to say: a number is missing, or the baseline is zero so there is no percentage.
export type Difference = { text: string; sign: -1 | 0 | 1 };

export function difference(value: number | undefined, baseline: number | undefined, as: "difference" | "percent", places?: number): Difference | null {
  if (value === undefined || baseline === undefined) return null;
  const change = value - baseline;
  if (Math.abs(change) <= 1e-12 * Math.max(1, Math.abs(baseline))) return { text: as === "percent" ? "0%" : "0", sign: 0 };
  const sign = change > 0 ? 1 : -1;
  const mark = sign > 0 ? "+" : "−";
  if (as === "difference") {
    const size = places === undefined ? formatNumber(Number(Math.abs(change).toPrecision(6))) : Math.abs(change).toFixed(places);
    return { text: `${mark}${size}`, sign };
  }
  if (baseline === 0) return null;
  return { text: `${mark}${formatNumber(Number(Math.abs((change / Math.abs(baseline)) * 100).toPrecision(3)))}%`, sign };
}

// Reads what was sent for saving, or says why it can't be used.
export function parseSnapshot(raw: unknown): ScenarioSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { values?: unknown; locked?: unknown };
  if (typeof r.values !== "object" || r.values === null || !Array.isArray(r.locked)) return null;
  const entries = Object.entries(r.values as Record<string, unknown>);
  if (entries.length > SCENARIO_LIMITS.variables || r.locked.length > SCENARIO_LIMITS.variables) return null;
  const values: Record<string, string> = {};
  for (const [name, text] of entries) {
    if (name.length > 120 || typeof text !== "string" || text.length > SCENARIO_LIMITS.text) return null;
    values[name] = text;
  }
  const locked = r.locked.filter((n): n is string => typeof n === "string" && n in values);
  return { values, locked };
}
