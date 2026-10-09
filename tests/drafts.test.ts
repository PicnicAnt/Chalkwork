import { describe, expect, it } from "vitest";
import { validateDraft, splitFormulas, type BoardDraft } from "@/lib/board-draft";
import { diffDrafts } from "@/lib/change-suggestions";
import { parseVisualizations, renameInVisualizations, dropFromVisualizations } from "@/lib/visualizations";

const base: BoardDraft = {
  title: "Rectangle",
  description: "",
  formulas: ["area = width * height"],
  values: { width: "3", height: "4" },
  descriptions: {},
  units: {},
  hidden: {},
  labels: {},
  decimals: {}, ranges: {}, tables: [], tags: [],
  includes: [],
  links: {},
  visualizations: [],
};

describe("checking a board before it is saved", () => {
  it("accepts a good board and keeps what was typed", () => {
    const { draft, errors } = validateDraft(base);
    expect(errors).toEqual([]);
    expect(draft?.formulas).toEqual(["area = width * height"]);
    expect(draft?.values).toEqual({ width: "3", height: "4" });
  });

  it("wants a title and at least one formula", () => {
    expect(validateDraft({ ...base, title: " " }).errors.join(" ")).toMatch(/title/i);
    expect(validateDraft({ ...base, formulas: [] }).errors.join(" ")).toMatch(/formula/i);
  });

  it("refuses a formula that can't make sense", () => {
    expect(validateDraft({ ...base, formulas: ["a = a - 2"] }).errors.length).toBeGreaterThan(0);
  });

  it("keeps ranges, drops empty ones and refuses a lowest above the highest", () => {
    expect(validateDraft({ ...base, ranges: { width: { min: 1, max: 9 }, height: {}, nothing: { min: 3 } } }).draft?.ranges).toEqual({ width: { min: 1, max: 9 } });
    expect(validateDraft({ ...base, ranges: { width: { min: 9, max: 1 } } }).errors.join(" ")).toMatch(/min of width/);
    expect(validateDraft({ ...base, ranges: { width: { min: "x" as unknown as number } } }).errors.join(" ")).toMatch(/must be a number/);
  });

  it("refuses decimals that aren't whole numbers from 0 to 10", () => {
    expect(validateDraft({ ...base, decimals: { area: 2.5 } }).errors.length).toBeGreaterThan(0);
    expect(validateDraft({ ...base, decimals: { area: 2 } }).draft?.decimals).toEqual({ area: 2 });
  });

  it("drops values and notes for variables that aren't in the formulas", () => {
    const { draft } = validateDraft({ ...base, values: { width: "3", gone: "9" }, descriptions: { gone: "x" } });
    expect(draft?.values).toEqual({ width: "3" });
    expect(draft?.descriptions).toEqual({});
  });

  it("needs every dimension of a drawing to be set", () => {
    const rect = { type: "rectangle", map: { width: "width" } };
    expect(validateDraft({ ...base, visualizations: [rect] }).errors.join(" ")).toMatch(/height/i);
    const ok = { type: "rectangle", map: { width: "width", height: "height" } };
    expect(validateDraft({ ...base, visualizations: [ok] }).draft?.visualizations).toEqual([ok]);
  });

  it("splits the formulas box into lines", () => {
    expect(splitFormulas(" a = 1 \n\n b = 2")).toEqual(["a = 1", "b = 2"]);
  });
});

describe("drawings and charts", () => {
  const known = new Set(["w", "h", "x", "y"]);

  it("drops types that don't exist and variables that aren't known", () => {
    const { visualizations } = parseVisualizations([{ type: "nonsense", map: {} }, { type: "rectangle", map: { width: "w", height: "nope" } }], known);
    expect(visualizations).toEqual([{ type: "rectangle", map: { width: "w" } }]);
  });

  it("keeps lists and numeric options of charts", () => {
    const { visualizations, errors } = parseVisualizations(
      [{ type: "sweep", map: { x: "x", y: "y" }, options: { from: 1, to: "bad" } }, { type: "breakdown", map: { total: "x" }, lists: { parts: ["w", "h", "zzz"] } }],
      known,
      true,
    );
    expect(errors).toEqual([]);
    expect(visualizations[0].options).toEqual({ from: 1 });
    expect(visualizations[1].lists).toEqual({ parts: ["w", "h"] });
  });

  it("insists on a part for a breakdown when asked to be strict", () => {
    expect(parseVisualizations([{ type: "breakdown", map: { total: "x" } }], known, true).errors).toHaveLength(1);
  });

  it("follows a renamed variable and forgets a removed board", () => {
    const viz = [{ type: "breakdown", map: { total: "a$t" }, lists: { parts: ["a$p", "own"] } }];
    expect(renameInVisualizations(viz, (n) => (n === "own" ? "mine" : n))[0].lists).toEqual({ parts: ["a$p", "mine"] });
    const dropped = dropFromVisualizations(viz, (n) => n.startsWith("a$"))[0];
    expect(dropped.map).toEqual({});
    expect(dropped.lists).toEqual({ parts: ["own"] });
  });
});

describe("listing what a suggestion changes", () => {
  it("says nothing when nothing is different", () => {
    expect(diffDrafts(base, { ...base })).toEqual([]);
  });

  it("names added and removed formulas and a changed title", () => {
    const next = { ...base, title: "Box", formulas: ["area = width * height", "volume = area * depth"] };
    const lines = diffDrafts(base, next);
    expect(lines).toContain('Title: "Rectangle" → "Box"');
    expect(lines).toContain("Formula added: volume = area * depth");
  });

  it("does not count 5 and 5.0, or a missing and an unhidden variable, as changes", () => {
    const a = { ...base, values: { width: "5" }, hidden: {} };
    const b = { ...base, values: { width: "5.0" }, hidden: { width: false } };
    expect(diffDrafts(a, b)).toEqual([]);
  });
});
