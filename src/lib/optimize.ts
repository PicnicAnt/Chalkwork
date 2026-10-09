import { compute } from "./calculator";
import { parseValue, type Analysis } from "./formulas";
import { seededRandom } from "./spread";

// "Find the best": the settings of some variables, each within its range, that make a result as large or as small
// as possible, optionally while another result stays above or below a limit. The search is a random scan of the
// ranges followed by a pattern search that moves along one variable at a time with shrinking steps. It needs no
// formulas of its own: it only asks the board "what do you get for these numbers?", so it works on any board,
// including ones solved backwards. It finds a good answer, not a proven best one.

export type Bound = { min: number; max: number; start: number };
export type Constraint = { op: "<=" | ">="; limit: number };
export type Evaluation = { objective: number; constraint?: number };

export type OptimizeInput = {
  bounds: Record<string, Bound>;
  /** What the board gives for these numbers, or null when it can't be solved (that point is skipped). */
  evaluate: (x: Record<string, number>) => Evaluation | null;
  maximize: boolean;
  constraint?: Constraint;
  /** How many times the board may be solved. */
  budget?: number;
};

export type OptimizeResult = {
  x: Record<string, number>;
  objective: number;
  constraint?: number;
  /** False when no point that keeps within the constraint was found; x is then the closest one. */
  feasible: boolean;
  evaluations: number;
};

const violation = (c: Constraint | undefined, value: number | undefined) =>
  !c || value === undefined ? 0 : c.op === "<=" ? Math.max(0, value - c.limit) : Math.max(0, c.limit - value);

export function optimize({ bounds, evaluate, maximize, constraint, budget = 500 }: OptimizeInput): OptimizeResult | null {
  const names = Object.keys(bounds);
  if (names.length === 0) return null;
  const rand = seededRandom(2024);
  let evaluations = 0;

  type Point = { x: Record<string, number>; objective: number; constraint?: number; bad: number };
  // Better means: less in breach of the constraint, then a better objective.
  const better = (a: Point, b: Point | null) =>
    !b || (a.bad < b.bad ? true : a.bad > b.bad ? false : maximize ? a.objective > b.objective : a.objective < b.objective);
  const probe = (x: Record<string, number>): Point | null => {
    evaluations++;
    const e = evaluate(x);
    if (!e || !Number.isFinite(e.objective)) return null;
    return { x, objective: e.objective, constraint: e.constraint, bad: violation(constraint, e.constraint) };
  };
  const clamp = (name: string, v: number) => Math.min(bounds[name].max, Math.max(bounds[name].min, v));

  let best: Point | null = probe(Object.fromEntries(names.map((n) => [n, clamp(n, bounds[n].start)])));
  // A random scan of the whole box, to find the right neighbourhood.
  const scan = Math.floor(budget * 0.4);
  for (let i = 0; i < scan; i++) {
    const p = probe(Object.fromEntries(names.map((n) => [n, bounds[n].min + rand() * (bounds[n].max - bounds[n].min)])));
    if (p && better(p, best)) best = p;
  }
  if (!best) return null;

  // A pattern search from the best point: step along each variable, and halve the steps when nothing improves.
  let step = 0.1;
  while (step > 1e-4 && evaluations < budget) {
    let moved = false;
    for (const name of names) {
      const width = bounds[name].max - bounds[name].min;
      for (const sign of [1, -1]) {
        if (evaluations >= budget) break;
        const x = { ...best.x, [name]: clamp(name, best.x[name] + sign * step * width) };
        if (x[name] === best.x[name]) continue;
        const p = probe(x);
        if (p && better(p, best)) {
          best = p;
          moved = true;
          break;
        }
      }
    }
    if (!moved) step /= 2;
  }
  return { x: best.x, objective: best.objective, constraint: best.constraint, feasible: best.bad === 0, evaluations };
}

// The board as something to optimize: the varied variables are held at the numbers tried, the other locks stay as
// they are, and the objective and the constrained variable are left free so the board can work them out.
export function boardEvaluator(
  analysis: Analysis,
  values: Record<string, string>,
  locked: string[],
  varied: string[],
  objective: string,
  constrained?: string,
): (x: Record<string, number>) => Evaluation | null {
  const free = new Set([objective, ...(constrained ? [constrained] : [])]);
  const others = locked.filter((n) => !varied.includes(n) && !free.has(n));
  return (x) => {
    try {
      const out = compute(analysis, { ...values, ...Object.fromEntries(varied.map((n) => [n, String(x[n])])) }, [...varied, ...others]);
      if (out.result.failed || out.broken.length > 0) return null;
      const o = parseValue(out.display[objective]);
      const c = constrained ? parseValue(out.display[constrained]) : undefined;
      if (o === undefined || (constrained && c === undefined)) return null;
      return { objective: o, constraint: c };
    } catch {
      return null;
    }
  };
}
