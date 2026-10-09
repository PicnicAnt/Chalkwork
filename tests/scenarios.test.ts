import { describe, expect, it } from "vitest";
import { analyzeFormulas } from "@/lib/formulas";
import { difference, outcomeOf, parseSnapshot, resultsOf } from "@/lib/scenarios";

const analysis = analyzeFormulas(["area = width * height"]);

describe("scenarios", () => {
  it("shows what a saved set of values gives on the board", () => {
    const a = resultsOf(analysis, { values: { width: "3", height: "4", area: "12" }, locked: ["width", "height"] });
    const b = resultsOf(analysis, { values: { width: "5", height: "4", area: "20" }, locked: ["width", "height"] });
    expect([a.area, b.area]).toEqual(["12", "20"]);
  });

  it("keeps the locks it was saved with, so a result can have been the input", () => {
    const out = resultsOf(analysis, { values: { width: "3", height: "1", area: "12" }, locked: ["width", "area"] });
    expect(out.height).toBe("4");
  });

  it("solves again with the board as it is now, and ignores variables that are gone", () => {
    const out = resultsOf(analysis, { values: { width: "2", height: "5", gone: "9" }, locked: ["width", "height", "gone"] });
    expect(out.area).toBe("10");
  });

  it("rounds the way the board does", () => {
    // A value that was typed shows as typed; a calculated one is rounded.
    const typed = resultsOf(analysis, { values: { width: "1", height: "1", area: "1.2345" }, locked: ["area", "width"] }, { area: 1 });
    expect(typed.area).toBe("1.2345");
    const calculated = resultsOf(analysis, { values: { width: "1.2345", height: "1" }, locked: ["width"] }, { area: 1 });
    expect(calculated.area).toBe("1.2");
  });

  it("accepts a good snapshot and refuses malformed ones", () => {
    expect(parseSnapshot({ values: { a: "1" }, locked: ["a", "zzz"] })).toEqual({ values: { a: "1" }, locked: ["a"] });
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ values: { a: 1 }, locked: [] })).toBeNull();
    expect(parseSnapshot({ values: { a: "x".repeat(200) }, locked: [] })).toBeNull();
    expect(parseSnapshot({ values: {}, locked: "a" })).toBeNull();
  });
});

describe("differences between scenarios", () => {
  it("gives the change and its sign", () => {
    expect(difference(15, 10, "difference")).toEqual({ text: "+5", sign: 1 });
    expect(difference(7.5, 10, "difference")).toEqual({ text: "−2.5", sign: -1 });
    expect(difference(10, 10, "difference")).toEqual({ text: "0", sign: 0 });
  });

  it("rounds the change the way the board does when it is told how", () => {
    expect(difference(10.126, 10, "difference", 1)).toEqual({ text: "+0.1", sign: 1 });
  });

  it("gives the change as a percentage of the baseline", () => {
    expect(difference(15, 10, "percent")).toEqual({ text: "+50%", sign: 1 });
    expect(difference(5, 10, "percent")).toEqual({ text: "−50%", sign: -1 });
    expect(difference(-5, -10, "percent")).toEqual({ text: "+50%", sign: 1 });
  });

  it("has nothing to say when a number is missing, or the baseline is zero for a percentage", () => {
    expect(difference(undefined, 10, "difference")).toBeNull();
    expect(difference(10, undefined, "percent")).toBeNull();
    expect(difference(5, 0, "percent")).toBeNull();
    expect(difference(5, 0, "difference")).toEqual({ text: "+5", sign: 1 });
  });

  it("works from the numbers a scenario gives", () => {
    const a = outcomeOf(analysis, { values: { width: "3", height: "4" }, locked: ["width", "height"] });
    const b = outcomeOf(analysis, { values: { width: "6", height: "4" }, locked: ["width", "height"] });
    expect(difference(b.numbers.area, a.numbers.area, "percent")).toEqual({ text: "+100%", sign: 1 });
  });
});
