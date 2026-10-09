import { describe, expect, it } from "vitest";
import { analyzeFormulas } from "@/lib/formulas";
import { checkUnits } from "@/lib/unit-check";
import { alternatives, describeDim, parseUnit, ratio } from "@/lib/units";

describe("understanding unit labels", () => {
  it("knows the dimension and size of common units", () => {
    expect(parseUnit("m")).toEqual({ dim: { L: 1 }, factor: 1 });
    expect(parseUnit("cm²")).toEqual({ dim: { L: 2 }, factor: 0.01 ** 2 });
    expect(parseUnit("km/h")?.dim).toEqual({ L: 1, T: -1 });
    expect(parseUnit("km/h")?.factor).toBeCloseTo(1000 / 3600);
    expect(parseUnit("/s")?.dim).toEqual({ T: -1 });
    expect(parseUnit("%")?.dim).toEqual({});
    expect(parseUnit("kWh")?.factor).toBe(3.6e6);
  });

  it("leaves what it doesn't know alone", () => {
    expect(parseUnit("widgets")).toBeNull();
    expect(parseUnit("dmg")).toBeNull();
    expect(parseUnit("")).toBeNull();
    expect(parseUnit(undefined)).toBeNull();
  });

  it("offers other units of the same kind and converts between them", () => {
    const alt = alternatives("m");
    expect(alt[0]).toBe("m");
    expect(alt).toEqual(expect.arrayContaining(["cm", "mm", "km", "ft", "in"]));
    expect(alt).not.toContain("m²");
    expect(alternatives("m²")).toEqual(expect.arrayContaining(["cm²", "km²", "ft²"]));
    expect(alternatives("km/h")).toEqual(expect.arrayContaining(["m/s", "mi/h"]));
    expect(ratio("m", "cm")).toBeCloseTo(100);
    expect(ratio("min", "h")).toBeCloseTo(1 / 60);
    expect(ratio("m", "s")).toBeNull();
  });

  it("does not convert what has no scale of its own", () => {
    expect(alternatives("$")).toEqual([]);
    expect(alternatives("%")).toEqual([]);
    expect(alternatives("widgets")).toEqual([]);
  });

  it("writes a dimension in SI units", () => {
    expect(describeDim({ L: 2 })).toBe("m²");
    expect(describeDim({ L: 1, T: -1 })).toBe("m·s⁻¹");
    expect(describeDim({})).toBe("a plain number");
  });
});

describe("checking that formulas fit their units", () => {
  const check = (formulas: string[], units: Record<string, string>) => checkUnits(analyzeFormulas(formulas), units);

  it("accepts formulas whose units work out", () => {
    expect(check(["area = width * height"], { width: "m", height: "m", area: "m²" })).toEqual([]);
    expect(check(["speed = distance / time"], { speed: "m/s", distance: "m", time: "s" })).toEqual([]);
    expect(check(["d = sqrt(a ^ 2 + b ^ 2)"], { a: "m", b: "m", d: "m" })).toEqual([]);
    expect(check(["circ = 2 * pi * r"], { r: "cm", circ: "cm" })).toEqual([]);
  });

  it("finds a sum of unlike things", () => {
    const problems = check(["x = length + time"], { length: "m", time: "s", x: "m" });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/adds/);
  });

  it("finds a result in the wrong kind of unit", () => {
    const problems = check(["area = width * height"], { width: "m", height: "m", area: "m" });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/m²/);
  });

  it("finds cm and m mixed up: the same kind but off by a factor", () => {
    const problems = check(["area = width * height"], { width: "m", height: "m", area: "cm²" });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/10,000 times/);
    expect(check(["total = a + b"], { a: "m", b: "cm", total: "m" })).toHaveLength(1);
  });

  it("lets plain numbers fit any unit, and treats percent as a plain number", () => {
    expect(check(["total = price + 5"], { price: "$", total: "$" })).toEqual([]);
    expect(check(["cost = qty * 5"], { qty: "kg", cost: "kg" })).toEqual([]);
    expect(check(["gain = start * rate / 100"], { start: "$", rate: "%", gain: "$" })).toEqual([]);
  });

  it("says nothing when a variable has no known unit", () => {
    expect(check(["area = width * height"], { width: "m", area: "cm" })).toEqual([]);
    expect(check(["x = a + b"], { a: "m", b: "widgets", x: "m" })).toEqual([]);
  });
});

describe("more checks", () => {
  const check = (formulas: string[], units: Record<string, string>) => checkUnits(analyzeFormulas(formulas), units);
  it("inverts a unit that a plain number is divided by", () => {
    expect(check(["rate = 1 / time"], { time: "s", rate: "/s" })).toEqual([]);
    expect(check(["rate = 10 / time"], { time: "s", rate: "s" })).toHaveLength(1);
  });
});

describe("time", () => {
  it("converts between seconds, minutes, hours, days, weeks, months and years, in short or long names", () => {
    expect(ratio("min", "s")).toBeCloseTo(60);
    expect(ratio("h", "min")).toBeCloseTo(60);
    expect(ratio("days", "h")).toBeCloseTo(24);
    expect(ratio("wk", "d")).toBeCloseTo(7);
    expect(ratio("year", "d")).toBeCloseTo(365.2425);
    expect(ratio("months", "years")).toBeCloseTo(1 / 12);
    expect(ratio("yr", "mo")).toBeCloseTo(12);
    expect(ratio("ms", "µs")).toBeCloseTo(1000);
  });

  it("offers the other units of time, the one it was written in first", () => {
    const alt = alternatives("months");
    expect(alt[0]).toBe("months");
    expect(alt).toEqual(expect.arrayContaining(["s", "min", "h", "d", "wk", "yr"]));
    expect(alternatives("/yr")).toEqual(expect.arrayContaining(["/s", "/d", "/mo"]));
  });

  it("checks time in formulas like any other unit", () => {
    const check = (formulas: string[], units: Record<string, string>) => checkUnits(analyzeFormulas(formulas), units);
    expect(check(["total = a + b"], { a: "h", b: "min", total: "h" })).toHaveLength(1);
    expect(check(["distance = speed * time"], { speed: "km/h", time: "h", distance: "km" })).toEqual([]);
  });
});
