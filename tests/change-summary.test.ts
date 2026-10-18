import { describe, expect, it } from "vitest";
import { summarizeChanges } from "@/lib/change-suggestions";
import { validateDraft } from "@/lib/board-draft";

const make = (extra: Record<string, unknown> = {}) => {
  const { draft, errors } = validateDraft({ title: "T", description: "", formulas: ["a = b * 2", "c = a + 1"], values: { b: "3" }, ...extra });
  if (!draft) throw new Error(errors.join(" "));
  return draft;
};

describe("the one-line summary of a save", () => {
  it("says nothing when nothing changed", () => {
    expect(summarizeChanges(make(), make())).toBe("");
  });
  it("counts what was added, changed and removed", () => {
    const next = make({ title: "T2", formulas: ["a = b * 3", "c = a + 1", "d = c * 2"], values: { b: "4" } });
    expect(summarizeChanges(make(), next)).toBe('Renamed the board to "T2", added 1 formula, changed 1 formula and changed 1 starting value.');
  });
  it("names presets", () => {
    const next = make({ presets: [{ name: "Big", values: { b: "9" }, locked: ["b"] }] });
    expect(summarizeChanges(make(), next)).toBe("Added the preset Big.");
  });
});
