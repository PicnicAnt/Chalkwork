import { describe, expect, it } from "vitest";
import { encodeItems, parseItems } from "@/lib/items-param";

describe("items in the address", () => {
  it("reads and writes group:board pairs", () => {
    const items = parseItems("gear:abc123,gear:DEF_456-x,bad,weird:!!");
    expect(items).toEqual([{ group: "gear", board: "abc123" }, { group: "gear", board: "DEF_456-x" }]);
    expect(encodeItems(items)).toBe("gear:abc123,gear:DEF_456-x");
    expect(parseItems(undefined)).toEqual([]);
  });

  it("keeps at most so many", () => {
    const many = Array.from({ length: 40 }, (_, i) => `g:board${String(i).padStart(3, "0")}`).join(",");
    expect(parseItems(many)).toHaveLength(20);
  });
});
