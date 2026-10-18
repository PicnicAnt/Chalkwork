import { describe, expect, it } from "vitest";
import { analyzeFormulas } from "@/lib/formulas";
import { presetOutcome } from "@/lib/scenarios";

describe("a preset worked out for comparing", () => {
  it("lays its values over the board's own starting values", () => {
    const analysis = analyzeFormulas(["a = b * 2", "c = a + d"]);
    const out = presetOutcome(analysis, { b: "1", d: "5" }, { name: "x", values: { b: "3" }, locked: ["b"] });
    expect(out.numbers.a).toBe(6);
    expect(out.numbers.c).toBe(11);
    expect(out.numbers.d).toBe(5);
  });
});
