import { describe, expect, it } from "vitest";
import { compute, initialLocks } from "@/lib/calculator";
import { analyzeFormulas, decidedBy, formulaProblems, parseValue, tokenize } from "@/lib/formulas";

describe("analysing formulas", () => {
  it("makes every name in the formulas a variable, in order of appearance", () => {
    const analysis = analyzeFormulas(["area = width * height", "perimeter = 2 * (width + height)"]);
    expect(analysis.variables.map((v) => v.name)).toEqual(["area", "width", "height", "perimeter"]);
  });

  it("does not treat functions and constants as variables", () => {
    const analysis = analyzeFormulas(["c = 2 * pi * r", "h = sqrt(a ^ 2 + b ^ 2)"]);
    expect(analysis.variables.map((v) => v.name).sort()).toEqual(["a", "b", "c", "h", "r"]);
  });

  it("colours tokens by kind", () => {
    const kinds = tokenize("dps = hit * 2").filter((t) => t.kind !== "text").map((t) => t.kind);
    expect(kinds).toEqual(["variable", "operator", "variable", "operator", "number"]);
  });
});

describe("solving", () => {
  const analysis = analyzeFormulas(["area = width * height"]);

  it("works forwards", () => {
    const out = compute(analysis, { width: "3", height: "4" }, ["width", "height"]);
    expect(out.display.area).toBe("12");
  });

  it("works backwards: the left-hand side can be the input", () => {
    const out = compute(analysis, { area: "12", width: "3" }, ["area", "width"]);
    expect(out.display.height).toBe("4");
  });

  it("keeps locked values as they are and recalculates the rest", () => {
    const out = compute(analysis, { width: "5", height: "4", area: "12" }, ["width", "height"]);
    expect(out.display.area).toBe("20");
    expect(out.display.width).toBe("5");
  });

  it("solves a chain of formulas in either direction", () => {
    const chain = analyzeFormulas(["b = a * 2", "c = b + 10"]);
    expect(compute(chain, { a: "5" }, ["a"]).display.c).toBe("20");
    expect(compute(chain, { c: "20" }, ["c"]).display.a).toBe("5");
  });

  it("solves numerically when a formula can't be turned around", () => {
    const hard = analyzeFormulas(["y = x ^ 3 + x"]);
    const out = compute(hard, { y: "10", x: "1" }, ["y"]);
    expect(Number(out.display.x)).toBeCloseTo(2, 6);
  });

  it("marks values that are fully decided as read-only", () => {
    const fixed = analyzeFormulas(["fee = 500", "total = price + fee"]);
    expect(decidedBy(fixed, []).has("fee")).toBe(true);
    expect(decidedBy(fixed, ["price"]).has("total")).toBe(true);
    expect(decidedBy(fixed, []).has("price")).toBe(false);
  });
});

describe("starting locks", () => {
  it("locks the variables that have a value, inputs first, as far as the formulas allow", () => {
    const analysis = analyzeFormulas(["area = width * height"]);
    // area, width and height all have values, but only two of them can be kept.
    const locks = initialLocks(analysis, { area: "12", width: "3", height: "4" });
    expect(locks).toEqual(["width", "height"]);
  });

  it("never locks a variable without a value", () => {
    const analysis = analyzeFormulas(["area = width * height"]);
    expect(initialLocks(analysis, { width: "3", height: "" })).toEqual(["width"]);
  });
});

describe("checking formulas", () => {
  it("accepts a plain set of formulas", () => {
    expect(formulaProblems(analyzeFormulas(["area = width * height"]))).toEqual([]);
  });

  it("flags a formula that can't make sense", () => {
    expect(formulaProblems(analyzeFormulas(["e1 = e1 - 2"])).length).toBeGreaterThan(0);
  });

  it("allows a formula that just sets a value", () => {
    expect(formulaProblems(analyzeFormulas(["speed_of_light = 299792458"]))).toEqual([]);
  });
});

describe("reading numbers", () => {
  it("accepts thousands separators and ignores empty text", () => {
    expect(parseValue("1,000")).toBe(1000);
    expect(parseValue("299,792,458")).toBe(299792458);
    expect(parseValue("")).toBeUndefined();
    expect(parseValue("abc")).toBeUndefined();
  });
});

describe("a line that is only a name", () => {
  it("declares the variable without making a result of it", () => {
    const a = analyzeFormulas(["speed", "trip = speed * hours", "weight"]);
    expect(a.variables.map((v) => v.name)).toEqual(["speed", "trip", "hours", "weight"]);
    expect(a.formulas).toHaveLength(1);
    expect(a.variables.some((v) => v.name.startsWith("result_"))).toBe(false);
    expect(formulaProblems(a)).toEqual([]);
  });

  it("a board that only declares variables has no problems", () => {
    const a = analyzeFormulas(["width", "height"]);
    expect(a.variables.map((v) => v.name)).toEqual(["width", "height"]);
    expect(formulaProblems(a)).toEqual([]);
  });
});
