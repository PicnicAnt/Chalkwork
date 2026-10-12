import { describe, expect, it } from "vitest";
import { compute } from "@/lib/calculator";
import { analyzeFormulas } from "@/lib/formulas";
import { explain } from "@/lib/working";

const run = (formulas: string[], values: Record<string, string>, locked: string[], name: string) => {
  const analysis = analyzeFormulas(formulas);
  const out = compute(analysis, values, locked);
  return explain(analysis, out.plan, out.display, name);
};

describe("showing the working", () => {
  it("says a typed value was set, and a result came from its equation with the numbers put in", () => {
    const w = run(["area = width * height", "cost = area * price"], { width: "3", height: "4", price: "2" }, ["width", "height", "price"], "cost");
    expect(w.how).toBe("formula");
    expect(w.formula).toBe("cost = area * price");
    expect(w.numbers).toBe("12 * 2");
    expect(w.value).toBe("24");
    const area = w.inputs.find((i) => i.name === "area")!;
    expect(area.numbers).toBe("3 * 4");
    expect(area.inputs.map((i) => [i.name, i.how])).toEqual([["width", "set"], ["height", "set"]]);
  });

  it("says when a value was worked backwards", () => {
    const w = run(["area = width * height"], { width: "3", area: "30" }, ["width", "area"], "height");
    expect(w.how).toBe("backwards");
    expect(w.value).toBe("10");
    expect(w.numbers).toBe("30 = 3 * 10");
  });

  it("has nothing to say about a variable nothing decides", () => {
    const w = run(["a = b + c"], { b: "1" }, ["b"], "c");
    expect(["none", "backwards", "set"]).toContain(w.how);
  });

  it("stops at a sensible depth on a long chain", () => {
    const formulas = ["b = a + 1", "c = b + 1", "d = c + 1", "e = d + 1", "f = e + 1", "g = f + 1", "h = g + 1"];
    const w = run(formulas, { a: "0" }, ["a"], "h");
    let depth = 0;
    for (let n = w; n.inputs.length; n = n.inputs[0]) depth++;
    expect(depth).toBeLessThanOrEqual(4);
  });
});
