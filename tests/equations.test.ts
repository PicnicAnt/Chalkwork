import { describe, expect, it } from "vitest";
import { compute, initialLocks } from "@/lib/calculator";
import { analyzeFormulas, parseValue } from "@/lib/formulas";

const solveFor = (lines: string[], values: Record<string, string> = {}) => {
  const analysis = analyzeFormulas(lines);
  const locked = initialLocks(analysis, values);
  return compute(analysis, values, locked);
};
const num = (out: ReturnType<typeof compute>, name: string) => parseValue(out.display[name]);

describe("equations with more than a name on the left", () => {
  it("solves 3*x+4=19", () => {
    const out = solveFor(["3*x+4=19"]);
    expect(num(out, "x")).toBeCloseTo(5, 6);
    expect(out.broken).toEqual([]);
  });
  it("reads the equation with the number on the left", () => {
    expect(num(solveFor(["19 = 3*x + 4"]), "x")).toBeCloseTo(5, 6);
  });
  it("uses the equation together with other formulas", () => {
    const out = solveFor(["area = w * h", "2*(w + h) = 30", "w = 6"]);
    expect(num(out, "h")).toBeCloseTo(9, 6);
    expect(num(out, "area")).toBeCloseTo(54, 6);
  });
  it("solves two equations at once", () => {
    const out = solveFor(["a + b = 10", "a - b = 2"]);
    expect(num(out, "a")).toBeCloseTo(6, 5);
    expect(num(out, "b")).toBeCloseTo(4, 5);
  });
  it("keeps a typed value over the equation", () => {
    const out = solveFor(["3*x+4=19"], { x: "7" });
    expect(num(out, "x")).toBe(7);
  });
  it("leaves ordinary formulas and comparisons alone", () => {
    const analysis = analyzeFormulas(["y = 2*x", "ok = x >= 3", "t = x == 3"]);
    expect(analysis.formulas.every((f) => !f.error && !f.equation)).toBe(true);
  });
  it("still refuses a left side that cannot be solved for", () => {
    expect(analyzeFormulas(["a = b = 3"]).formulas[0].error).toBeTruthy();
  });
});
