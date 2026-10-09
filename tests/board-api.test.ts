import { describe, expect, it } from "vitest";
import { flatten, type Bundle } from "@/lib/boards";
import { solveBoard } from "@/lib/board-api";

const empty = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, ranges: {}, tables: [], links: {}, visualizations: [] };
const bundleOf = (formulas: string[], more: Partial<typeof empty> = {}): Bundle => flatten({ ...empty, formulas, ...more }, []).bundle;

describe("using a board from code", () => {
  const rectangle = bundleOf(["area = width * height", "perimeter = 2 * (width + height)"], {
    values: { width: "3", height: "4" },
    units: { width: "m", area: "m²" },
    labels: { area: "Area" },
  });

  it("gives everything the board works out for the inputs", () => {
    const out = solveBoard(rectangle, { width: 5, height: "6" });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.inputs).toEqual({ width: 5, height: 6 });
    expect(out.results.area).toEqual({ value: 30, unit: "m²", label: "Area", fixed: false });
    expect(out.results.perimeter.value).toBe(22);
    expect(out.results.width.fixed).toBe(true);
  });

  it("starts from the board's own values when no inputs are given", () => {
    const out = solveBoard(rectangle, {});
    expect(out.ok && out.results.area.value).toBe(12);
  });

  it("solves backwards: an output can be an input", () => {
    const out = solveBoard(rectangle, { area: 20, width: 4 });
    expect(out.ok && out.results.height.value).toBe(5);
  });

  it("refuses names it doesn't have and values that aren't numbers", () => {
    const unknown = solveBoard(rectangle, { depth: 1 });
    expect(unknown.ok).toBe(false);
    expect(!unknown.ok && unknown.status).toBe(400);
    expect(!unknown.ok && unknown.error).toMatch(/Unknown variable: depth/);
    expect(!unknown.ok && unknown.error).toMatch(/width/);
    const bad = solveBoard(rectangle, { width: "wide" });
    expect(!bad.ok && bad.error).toMatch(/must be a number/);
  });

  it("says so when no values fit", () => {
    const fixed = bundleOf(["speed = 299792458", "x = speed * 2"]);
    const out = solveBoard(fixed, { speed: 5 });
    expect(out.ok).toBe(false);
    expect(!out.ok && out.status).toBe(422);
  });

  it("leaves out what the creator hid", () => {
    const hidden = bundleOf(["a = b * 2"], { values: { b: "1" }, hidden: { b: true } });
    const out = solveBoard(hidden, {});
    expect(out.ok && Object.keys(out.results)).toEqual(["a"]);
  });
});
