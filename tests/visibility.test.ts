import { describe, expect, it } from "vitest";
import { validateDraft } from "@/lib/board-draft";
import { canOpen, isListed, visibilityOf } from "@/lib/visibility";

const base = { title: "T", description: "", formulas: ["a = b * 2"], values: {}, descriptions: {}, units: {}, hidden: {}, labels: {}, decimals: {}, ranges: {}, tables: [], order: [], tags: [], includes: [], links: {}, visualizations: [] };

describe("who can open a board", () => {
  it("a private board is only for its owner, the others are for anyone with the link", () => {
    expect(canOpen({ visibility: "private", ownerId: "u1" }, "u1")).toBe(true);
    expect(canOpen({ visibility: "private", ownerId: "u1" }, "u2")).toBe(false);
    expect(canOpen({ visibility: "private", ownerId: "u1" }, null)).toBe(false);
    expect(canOpen({ visibility: "link", ownerId: "u1" }, null)).toBe(true);
    expect(canOpen({ ownerId: "u1" }, null)).toBe(true);
  });

  it("only public boards are listed for others, and everything of yours for you", () => {
    expect(isListed({ visibility: "public", ownerId: "u1" }, "u2")).toBe(true);
    expect(isListed({ visibility: "link", ownerId: "u1" }, "u2")).toBe(false);
    expect(isListed({ visibility: "link", ownerId: "u1" }, "u1")).toBe(true);
    expect(isListed({ visibility: "private", ownerId: "u1" }, "u2")).toBe(false);
  });

  it("anything unknown is public, and a draft keeps its setting", () => {
    expect(visibilityOf("secret")).toBe("public");
    expect(validateDraft({ ...base, visibility: "private" }).draft?.visibility).toBe("private");
    expect(validateDraft({ ...base, visibility: "nonsense" }).draft?.visibility).toBe("public");
  });
});
