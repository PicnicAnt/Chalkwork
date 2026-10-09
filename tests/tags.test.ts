import { describe, expect, it } from "vitest";
import { cleanTag, parseTags, TAG_LIMITS } from "@/lib/tags";

describe("tags", () => {
  it("cleans a tag to lower case with dashes", () => {
    expect(cleanTag("  Path of Exile! ")).toBe("path-of-exile");
    expect(cleanTag("Økonomi")).toBe("økonomi");
    expect(cleanTag("---")).toBe("");
  });

  it("reads tags typed with commas, without repeats", () => {
    expect(parseTags("Finance, game, FINANCE, , loan")).toEqual(["finance", "game", "loan"]);
    expect(parseTags(["a", 3, "b"])).toEqual(["a", "b"]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it("keeps at most so many, each so long", () => {
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(TAG_LIMITS.count);
    expect(cleanTag("a".repeat(60))).toHaveLength(TAG_LIMITS.length);
  });
});
