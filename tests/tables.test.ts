import { describe, expect, it } from "vitest";
import { flatten } from "@/lib/boards";
import { analyzeFormulas, formulaProblems } from "@/lib/formulas";
import { compute } from "@/lib/calculator";
import { lookup, parseTableRows, parseTables, type Table } from "@/lib/tables";

const brackets: Table = { name: "rate", mode: "step", rows: [[0, 10], [20000, 20], [50000, 30]] };
const curve: Table = { name: "curve", mode: "linear", rows: [[0, 0], [10, 100], [20, 100], [30, 0]] };

describe("lookup tables", () => {
  it("a step table gives the row at or below the value", () => {
    expect(lookup(brackets, 100)).toBe(10);
    expect(lookup(brackets, 20000)).toBe(20);
    expect(lookup(brackets, 49999)).toBe(20);
    expect(lookup(brackets, 1e9)).toBe(30);
    expect(lookup(brackets, -5)).toBe(10);
  });

  it("a linear table draws straight lines between the rows and holds the ends", () => {
    expect(lookup(curve, 5)).toBe(50);
    expect(lookup(curve, 15)).toBe(100);
    expect(lookup(curve, 25)).toBe(50);
    expect(lookup(curve, 99)).toBe(0);
    expect(lookup(curve, -1)).toBe(0);
  });

  it("reads rows from text and says which line is wrong", () => {
    expect(parseTableRows("20, 2\n0 1\n\n10;1.5").rows).toEqual([[0, 1], [10, 1.5], [20, 2]]);
    expect(parseTableRows("1 2\nabc").problem).toMatch(/Line 2/);
    expect(parseTableRows("1 2 3").problem).toMatch(/Line 1/);
  });

  it("checks tables that were sent", () => {
    expect(parseTables([{ name: "a", mode: "linear", rows: [[1, 2], [0, 0]] }])).toEqual({ tables: [{ name: "a", mode: "linear", rows: [[0, 0], [1, 2]] }], errors: [] });
    expect(parseTables([{ name: "1a", rows: [] }]).errors.length).toBeGreaterThan(0);
    expect(parseTables([{ name: "a", rows: [[1, 1], [1, 2]] }]).errors.join(" ")).toMatch(/two rows for 1/);
    expect(parseTables([{ name: "a", rows: [[1, 1]] }, { name: "a", rows: [[1, 1]] }]).errors.join(" ")).toMatch(/Two tables/);
  });
});

describe("conditions and tables in formulas", () => {
  it("if() picks between two values", () => {
    const a = analyzeFormulas(["fee = if(amount > 100, 5, 2)"]);
    expect(compute(a, { amount: "50" }, ["amount"]).display.fee).toBe("2");
    expect(compute(a, { amount: "500" }, ["amount"]).display.fee).toBe("5");
  });

  it("works with and, or and the ?: form too", () => {
    const a = analyzeFormulas(["ok = if(x > 1 and x < 5, 1, 0)", "z = x > 3 ? 10 : 20"]);
    expect(compute(a, { x: "2" }, ["x"]).display.ok).toBe("1");
    expect(compute(a, { x: "6" }, ["x"]).display.ok).toBe("0");
    expect(compute(a, { x: "4" }, ["x"]).display.z).toBe("10");
  });

  it("a table can be called like a function, forwards and backwards", () => {
    const a = analyzeFormulas(["y = curve(x)"], [curve]);
    expect(compute(a, { x: "5" }, ["x"]).display.y).toBe("50");
    // Backwards on the rising part: which x gives 50?
    expect(Number(compute(a, { y: "50" }, ["y"]).display.x)).toBeCloseTo(5, 3);
  });

  it("a step table in a tax formula", () => {
    const a = analyzeFormulas(["tax = income * rate(income) / 100", "net = income - tax"], [brackets]);
    expect(compute(a, { income: "30000" }, ["income"]).display.net).toBe("24000");
  });

  it("an unknown function is a problem on its line", () => {
    const problems = formulaProblems(analyzeFormulas(["a = nothing(b)", "c = d * 2"]));
    expect(problems.map((p) => p.line)).toContain(1);
    expect(problems.find((p) => p.line === 1)?.message).toMatch(/nothing/);
    expect(formulaProblems(analyzeFormulas(["a = curve(b)"], [curve]))).toEqual([]);
  });

  it("a used board's tables and calls to them get its alias", () => {
    const own = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, ranges: {}, links: {}, visualizations: [], tables: [] as Table[], order: [] };
    const inner = flatten({ ...own, formulas: ["y = curve(x)"], tables: [curve] }, []).bundle;
    const outer = flatten({ ...own, formulas: ["total = tax$y"] }, [{ alias: "tax", board: "b", title: "Tax", bundle: inner }]).bundle;
    expect(outer.formulas).toContain("tax$y = tax$curve(tax$x)");
    expect(outer.tables.map((t) => t.name)).toEqual(["tax$curve"]);
    const a = analyzeFormulas(outer.formulas, outer.tables);
    expect(compute(a, { tax$x: "5" }, ["tax$x"]).display.total).toBe("50");
  });
});

describe("solving backwards through conditions and tables", () => {
  it("finds the income that gives a take-home pay, though the tax jumps between tiers", () => {
    const rates: Table = { name: "tax_rate", mode: "step", rows: [[0, 10], [20000, 20], [50000, 30]] };
    const a = analyzeFormulas(
      ["deduction = if(income > 40000, 2000, 1000)", "taxable = income - deduction", "rate = tax_rate(taxable)", "tax = taxable * rate / 100", "net = income - tax"],
      [rates],
    );
    const out = compute(a, { net: "50000" }, ["net"]);
    // 30% tier: 0.7 * taxable + 2000 = 50000, so taxable = 68571.4 and income = 70571.4.
    expect(Number(out.display.income)).toBeCloseTo(70571.43, 1);
  });
});

describe("items in a group are summed", () => {
  const own = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, ranges: {}, links: {}, visualizations: [], tables: [] as Table[], order: [] };
  const item = (formulas: string[], values: Record<string, string>, units: Record<string, string> = {}) => flatten({ ...own, formulas, values, units }, []).bundle;
  const sword = item(["damage", "strength"], { damage: "10", strength: "2" }, { damage: "pts" });
  const helm = item(["strength", "armor"], { strength: "3", armor: "5" });

  it("makes a total per variable and an equipped switch per item", () => {
    const { bundle } = flatten(
      { ...own, formulas: ["power = gear.strength * 10 + base"], values: { base: "7" } },
      [
        { alias: "sword", board: "s", title: "Sword", group: "gear", bundle: sword },
        { alias: "helm", board: "h", title: "Helm", group: "gear", bundle: helm },
      ],
    );
    expect(bundle.formulas).toContain("power = gear$strength * 10 + base");
    expect(bundle.formulas).toContain("gear$strength = sword$equipped * sword$strength + helm$equipped * helm$strength");
    expect(bundle.formulas).toContain("gear$armor = helm$equipped * helm$armor");
    expect(bundle.values.sword$equipped).toBe("1");
    expect(bundle.units.gear$damage).toBe("pts");
    expect(bundle.groups.gear.title).toBe("Gear (total)");
    const a = analyzeFormulas(bundle.formulas, bundle.tables);
    const all = { ...bundle.values };
    expect(compute(a, all, Object.keys(all)).display.power).toBe("57");
    // Leave the helm out: only the sword's strength counts.
    expect(compute(a, { ...all, helm$equipped: "0" }, Object.keys(all)).display.power).toBe("27");
  });

  it("refuses a group named like a used board", async () => {
    const { parseIncludes } = await import("@/lib/boards");
    const out = parseIncludes([{ board: "a", alias: "gear" }, { board: "b", alias: "x", group: "gear" }]);
    expect(out.errors.join(" ")).toMatch(/same name as a used board/);
    expect(parseIncludes([{ board: "a", alias: "x", group: "gear" }]).includes[0].group).toBe("gear");
  });
});

describe("collections people add items to", () => {
  const own = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, ranges: {}, links: {}, visualizations: [], tables: [] as Table[], order: [] };
  const board = (collections: { name: string; stats: string[] }[], items: { alias: string; formulas: string[]; values: Record<string, string> }[]) =>
    flatten(
      { ...own, formulas: ["power = gear.strength * 10 + base"], values: { base: "7" }, collections },
      items.map((i) => ({ alias: i.alias, board: i.alias, title: i.alias, group: "gear", bundle: flatten({ ...own, formulas: i.formulas, values: i.values }, []).bundle })),
    );

  it("has totals of 0 while there are no items, so formulas still work", () => {
    const { bundle, ownErrors } = board([{ name: "gear", stats: ["strength"] }], []);
    expect(ownErrors).toEqual([]);
    expect(bundle.formulas).toContain("gear$strength = 0");
    const a = analyzeFormulas(bundle.formulas, bundle.tables);
    expect(compute(a, bundle.values, ["base"]).display.power).toBe("7");
  });

  it("adds up only the listed stats of the items", () => {
    const { bundle } = board(
      [{ name: "gear", stats: ["strength"] }],
      [{ alias: "item1", formulas: ["strength", "luck"], values: { strength: "4", luck: "9" } }, { alias: "item2", formulas: ["luck"], values: { luck: "1" } }],
    );
    expect(bundle.formulas).toContain("gear$strength = item1$equipped * item1$strength");
    expect(bundle.formulas.some((f) => f.startsWith("gear$luck"))).toBe(false);
    const a = analyzeFormulas(bundle.formulas, bundle.tables);
    expect(compute(a, bundle.values, Object.keys(bundle.values)).display.power).toBe("47");
  });
});
