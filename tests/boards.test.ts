import { describe, expect, it } from "vitest";
import {
  checkAlias,
  defaultAlias,
  dropAliasLinks,
  flatten,
  groupOf,
  parseIncludes,
  renameAliasInText,
  renameAliasLinks,
  sectionsByBoard,
  type Bundle,
  type IncludedBundle,
} from "@/lib/boards";

const empty = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, links: {}, visualizations: [] };

const rectangle: Bundle = {
  ...empty,
  formulas: ["area = width * height"],
  values: { width: "3", height: "4" },
  units: { width: "m" },
  groups: {},
};
const used = (alias: string, bundle: Bundle = rectangle): IncludedBundle => ({ alias, board: `id-${alias}`, title: "Rectangle", bundle });

describe("boards that use boards", () => {
  it("brings the formulas and values of a used board in, under its alias", () => {
    const { bundle, ownErrors } = flatten({ ...empty, formulas: ["total = room.area * 2"] }, [used("room")]);
    expect(ownErrors).toEqual([]);
    expect(bundle.formulas).toEqual(["total = room$area * 2", "room$area = room$width * room$height"]);
    expect(bundle.values).toEqual({ room$width: "3", room$height: "4" });
    expect(bundle.units).toEqual({ room$width: "m" });
  });

  it("lets a board use the same board twice under different aliases", () => {
    const { bundle } = flatten({ ...empty, formulas: ["both = a.area + b.area"] }, [used("a"), used("b")]);
    expect(Object.keys(bundle.values).sort()).toEqual(["a$height", "a$width", "b$height", "b$width"]);
  });

  it("lets what the board sets win over what a used board says", () => {
    const { bundle } = flatten({ ...empty, formulas: ["x = room.area"], values: { room$width: "10" }, units: { room$width: "cm" } }, [used("room")]);
    expect(bundle.values.room$width).toBe("10");
    expect(bundle.units.room$width).toBe("cm");
  });

  it("turns links into equations that follow each other", () => {
    const { bundle } = flatten({ ...empty, formulas: ["x = 1"], links: { a$width: "b$height" } }, [used("a"), used("b")]);
    expect(bundle.formulas).toContain("a$width = b$height");
  });

  it("says which formulas name a board that isn't used", () => {
    const { ownErrors } = flatten({ ...empty, formulas: ["x = nobody.area"] }, []);
    expect(ownErrors).toHaveLength(1);
    expect(ownErrors[0].message).toMatch(/nobody/);
  });

  it("carries a used board's drawings, tagged with the board they belong to", () => {
    const withDrawing: Bundle = { ...rectangle, visualizations: [{ type: "rectangle", map: { width: "width", height: "height" } }] };
    const { bundle } = flatten({ ...empty, formulas: ["x = room.area"] }, [used("room", withDrawing)]);
    expect(bundle.visualizations).toEqual([{ type: "rectangle", map: { width: "room$width", height: "room$height" }, group: "room" }]);
  });
});

describe("aliases and links", () => {
  it("accepts good aliases and refuses bad ones", () => {
    expect(checkAlias("player")).toBeNull();
    expect(checkAlias("1player")).not.toBeNull();
    expect(checkAlias("a b")).not.toBeNull();
    expect(checkAlias("sqrt")).not.toBeNull();
  });

  it("makes an alias from a title and keeps it unique", () => {
    expect(defaultAlias("Attack DPS", [])).toBe("attack_dps");
    expect(defaultAlias("Attack DPS", ["attack_dps"])).toBe("attack_dps_2");
  });

  it("reads the list of used boards, dropping repeats", () => {
    const { includes, errors } = parseIncludes([
      { board: "x", alias: "one" },
      { board: "y", alias: "one" },
      { board: "z", alias: "two", name: " Second " },
    ]);
    expect(includes).toEqual([{ board: "x", alias: "one" }, { board: "z", alias: "two", name: "Second" }]);
    expect(errors).toHaveLength(1);
  });

  it("renames an alias in formulas and in links", () => {
    expect(renameAliasInText("a.x + a.y", "a", "b")).toBe("b.x + b.y");
    expect(renameAliasLinks({ a$x: "own", own2: "a$y" }, "a", "b")).toEqual({ b$x: "own", own2: "b$y" });
  });

  it("drops the links that reach into a removed board", () => {
    expect(dropAliasLinks({ a$x: "own", keep: "other" }, "a")).toEqual({ keep: "other" });
  });

  it("finds which board a variable belongs to", () => {
    expect(groupOf("room$width")).toBe("room");
    expect(groupOf("width")).toBeNull();
  });

  it("lists variables under the board they come from, the board's own first", () => {
    const sections = sectionsByBoard([{ name: "total" }, { name: "room$width" }, { name: "room$height" }, { name: "x" }], { room: {} });
    expect(sections.map((s) => [s.key, s.variables.map((v) => v.name)])).toEqual([
      [null, ["total", "x"]],
      ["room", ["room$width", "room$height"]],
    ]);
  });
});
