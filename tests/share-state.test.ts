import { describe, expect, it } from "vitest";
import { decodeState, encodeState, MAX_STATE_LENGTH } from "@/lib/share-state";

describe("sharing the state of a board in a link", () => {
  it("round-trips the typed values and the locks", () => {
    const state = { values: { width: "3", height: "4.5", area: "13.5" }, locked: ["width", "height"] };
    const text = encodeState(state);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState(text)).toEqual({ values: { width: "3", height: "4.5" }, locked: ["width", "height"] });
  });

  it("carries names and values with any characters, such as the alias separator and accents", () => {
    const state = { values: { room$bredde: "3,5", "æøå": "1" }, locked: ["room$bredde", "æøå"] };
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it("refuses text that is not a state, is too long, or has the wrong shape", () => {
    expect(decodeState(undefined)).toBeNull();
    expect(decodeState("")).toBeNull();
    expect(decodeState("not a state!")).toBeNull();
    expect(decodeState("a".repeat(MAX_STATE_LENGTH + 1))).toBeNull();
    expect(decodeState(btoa(JSON.stringify({ values: 3, locked: [] })))).toBeNull();
    expect(decodeState(btoa(JSON.stringify({ values: { a: 1 }, locked: [] })))).toBeNull();
  });
});
