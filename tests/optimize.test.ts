import { describe, expect, it } from "vitest";
import { flatten } from "@/lib/boards";
import { analyzeFormulas } from "@/lib/formulas";
import { boardEvaluator, optimize } from "@/lib/optimize";

describe("finding the best settings", () => {
  it("finds the top of a hill", () => {
    const out = optimize({
      bounds: { x: { min: -10, max: 10, start: 0 }, y: { min: -10, max: 10, start: 0 } },
      evaluate: ({ x, y }) => ({ objective: 5 - (x - 3) ** 2 - (y + 2) ** 2 }),
      maximize: true,
    })!;
    expect(out.x.x).toBeCloseTo(3, 1);
    expect(out.x.y).toBeCloseTo(-2, 1);
    expect(out.feasible).toBe(true);
  });

  it("can look for the lowest instead", () => {
    const out = optimize({ bounds: { x: { min: 0, max: 10, start: 9 } }, evaluate: ({ x }) => ({ objective: (x - 4) ** 2 }), maximize: false })!;
    expect(out.x.x).toBeCloseTo(4, 2);
  });

  it("stays inside the ranges even when the best is outside", () => {
    const out = optimize({ bounds: { x: { min: 0, max: 5, start: 1 } }, evaluate: ({ x }) => ({ objective: x }), maximize: true })!;
    expect(out.x.x).toBe(5);
  });

  it("keeps a result within its limit", () => {
    // Maximize x + y with x + 2y no more than 10 (and both from 0 to 10): the best is x = 10, y = 0.
    const out = optimize({
      bounds: { x: { min: 0, max: 10, start: 1 }, y: { min: 0, max: 10, start: 1 } },
      evaluate: ({ x, y }) => ({ objective: x + y, constraint: x + 2 * y }),
      maximize: true,
      constraint: { op: "<=", limit: 10 },
    })!;
    expect(out.feasible).toBe(true);
    expect(out.constraint!).toBeLessThanOrEqual(10 + 1e-9);
    expect(out.objective).toBeGreaterThan(9.5);
  });

  it("says when the limit can't be met", () => {
    const out = optimize({ bounds: { x: { min: 0, max: 1, start: 0 } }, evaluate: ({ x }) => ({ objective: x, constraint: x }), maximize: true, constraint: { op: ">=", limit: 5 } })!;
    expect(out.feasible).toBe(false);
    expect(out.x.x).toBe(1);
  });

  it("skips points the board can't solve, and has nothing to do without variables", () => {
    const out = optimize({ bounds: { x: { min: 0, max: 10, start: 5 } }, evaluate: ({ x }) => (x > 8 ? null : { objective: x }), maximize: true })!;
    expect(out.x.x).toBeGreaterThan(7.9);
    expect(out.x.x).toBeLessThanOrEqual(8);
    expect(optimize({ bounds: {}, evaluate: () => ({ objective: 1 }), maximize: true })).toBeNull();
  });

  it("works on a board: the biggest area for a fixed fence", () => {
    const empty = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, ranges: {}, tables: [], links: {}, visualizations: [] };
    const { bundle } = flatten({ ...empty, formulas: ["area = width * length", "fence = 2 * (width + length)"], values: { width: "4", length: "6", fence: "20" } }, []);
    const analysis = analyzeFormulas(bundle.formulas);
    // The fence is locked at 20; width is varied; length and area are worked out.
    const evaluate = boardEvaluator(analysis, bundle.values, ["fence", "width"], ["width"], "area");
    const out = optimize({ bounds: { width: { min: 1, max: 9, start: 4 } }, evaluate, maximize: true })!;
    expect(out.x.width).toBeCloseTo(5, 1);
    expect(out.objective).toBeCloseTo(25, 1);
  });
});
