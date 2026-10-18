import { describe, expect, it } from "vitest";
import { choose, countCombinations, loadouts } from "@/lib/loadout";

describe("loadout combinations", () => {
  it("chooses without repeating a piece", () => {
    expect(choose(["a", "b", "c"], 2)).toEqual([["a", "b"], ["a", "c"], ["b", "c"]]);
    expect(choose(["a"], 2)).toEqual([]);
    expect(choose(["a", "b"], 0)).toEqual([[]]);
  });
  it("counts what it would make", () => {
    expect(countCombinations([{ options: 4, take: 1 }, { options: 4, take: 2 }, { options: 4, take: 2 }])).toBe(144);
    expect(countCombinations([{ options: 2, take: 3 }])).toBe(0);
  });
  it("combines the groups", () => {
    const sets = loadouts([
      { group: "W", options: [{ group: "W", board: "w1" }, { group: "W", board: "w2" }], take: 1 },
      { group: "A", options: [{ group: "A", board: "a1" }, { group: "A", board: "a2" }, { group: "A", board: "a3" }], take: 2 },
    ]);
    expect(sets).toHaveLength(6);
    expect(sets[0].map((i) => i.board)).toEqual(["w1", "a1", "a2"]);
  });
});
