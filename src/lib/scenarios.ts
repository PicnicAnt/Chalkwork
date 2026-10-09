import { compute, shownValues } from "./calculator";
import type { Analysis } from "./formulas";

// A scenario is a named set of values for a board: what is typed (and so locked) and the numbers that
// went with it. It is the user's own; nobody else sees it.
export type ScenarioSnapshot = { values: Record<string, string>; locked: string[] };
export type Scenario = { id: string; name: string } & ScenarioSnapshot;

export const SCENARIO_LIMITS = { name: 40, perBoard: 20, variables: 300, text: 50 };

// What a scenario shows on this board as it is now: the board is solved again with the values kept
// where they were locked, so a change to the board since shows up. Numbers are rounded as the board does.
export function resultsOf(analysis: Analysis, snapshot: ScenarioSnapshot, decimals?: Record<string, number>): Record<string, string> {
  const locked = snapshot.locked.filter((name) => analysis.variables.some((v) => v.name === name));
  const out = compute(analysis, snapshot.values, locked);
  return shownValues(out.display, out.plan.held, decimals);
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
