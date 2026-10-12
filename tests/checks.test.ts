import { describe, expect, it } from "vitest";
import { parseChecks, runCheck } from "@/lib/checks";
import { analyzeFormulas } from "@/lib/formulas";

const analysis = analyzeFormulas(["area = width * height", "perimeter = 2 * (width + height)"], []);

describe("checks on a board", () => {
  it("passes when the board works out what was expected", () => {
    const r = runCheck(analysis, {}, { name: "3 by 4", set: { width: "3", height: "4" }, expect: { area: "12", perimeter: "14" } });
    expect(r.ok).toBe(true);
    expect(r.rows.every((x) => x.ok)).toBe(true);
  });

  it("works backwards too: a locked result sets an input", () => {
    const r = runCheck(analysis, {}, { name: "square", set: { width: "5", area: "25" }, expect: { height: "5" } });
    expect(r.ok).toBe(true);
  });

  it("fails and says which result is different", () => {
    const r = runCheck(analysis, {}, { name: "wrong", set: { width: "3", height: "4" }, expect: { area: "13" } });
    expect(r.ok).toBe(false);
    expect(r.rows[0]).toMatchObject({ name: "area", expected: "13", got: "12", ok: false });
  });

  it("fails when a variable it names is gone", () => {
    const r = runCheck(analysis, {}, { name: "old", set: { width: "3", gone: "1" }, expect: { area: "12" } });
    expect(r.ok).toBe(false);
  });

  it("keeps only sensible checks", () => {
    const kept = parseChecks([
      { name: " ok ", set: { a: "1" }, expect: { b: "2" } },
      { name: "", set: { a: "1" }, expect: { b: "2" } },
      { name: "no set", set: {}, expect: { b: "2" } },
      { name: "text", set: { a: "x" }, expect: { b: "2" } },
      "nonsense",
    ]);
    expect(kept).toEqual([{ name: "ok", set: { a: "1" }, expect: { b: "2" } }]);
    expect(parseChecks(undefined)).toEqual([]);
  });
});
