import { describe, expect, it } from "vitest";
import { parseTable } from "@/lib/preset-import";

const vars = ["min_damage", "max_damage", "crit_chance", "base_speed"];
const labels = { min_damage: "Lowest hit", base_speed: "Attack speed" };

describe("presets from a pasted table", () => {
  it("reads a spreadsheet pasted with tabs, matching names and labels", () => {
    const out = parseTable("Weapon\tLowest hit\tmax_damage\tCrit chance\nDagger\t6\t11\t12\nSword\t14\t22\t6", vars, labels);
    expect(out.unmatched).toEqual([]);
    expect(out.presets).toEqual([
      { name: "Dagger", values: { min_damage: "6", max_damage: "11", crit_chance: "12" }, locked: ["min_damage", "max_damage", "crit_chance"] },
      { name: "Sword", values: { min_damage: "14", max_damage: "22", crit_chance: "6" }, locked: ["min_damage", "max_damage", "crit_chance"] },
    ]);
  });
  it("reads a comma file with quotes and thousands, and reports what it could not use", () => {
    const out = parseTable('name,min_damage,colour\n"Big, heavy",1000,red\n,5,blue\nFast,"1,500",x', vars, labels);
    expect(out.unmatched).toEqual(["colour"]);
    expect(out.presets.map((p) => [p.name, p.values.min_damage])).toEqual([["Big, heavy", "1000"], ["Fast", "1500"]]);
    expect(out.skipped).toEqual(["A row without a name."]);
  });
  it("reads decimal commas in a semicolon file", () => {
    const out = parseTable("name;Attack speed\nSlow;0,7", vars, labels);
    expect(out.presets[0].values.base_speed).toBe("0.7");
  });
  it("says what is missing", () => {
    expect(parseTable("only one line", vars, labels).presets).toEqual([]);
    expect(parseTable("min_damage,max_damage\n1,2", vars, labels).skipped[0]).toMatch(/names of the presets/);
  });
});
