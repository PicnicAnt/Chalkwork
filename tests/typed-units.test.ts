import { describe, expect, it } from "vitest";
import { readWithUnit } from "@/lib/units";

describe("numbers typed with a unit", () => {
  it("converts into the unit of the field", () => {
    expect(readWithUnit("5 km", "m")).toBe("5000");
    expect(readWithUnit("30min", "h")).toBe("0.5");
    expect(readWithUnit("2.5 h", "min")).toBe("150");
    expect(readWithUnit("1.5 m", "cm")).toBe("150");
  });
  it("takes off the unit the field is already in", () => {
    expect(readWithUnit("5 m", "m")).toBe("5");
  });
  it("leaves alone what is not a number with a unit that fits", () => {
    expect(readWithUnit("5 kg", "m")).toBeNull();
    expect(readWithUnit("5", "m")).toBeNull();
    expect(readWithUnit("5e3", "m")).toBeNull();
    expect(readWithUnit("abc", "m")).toBeNull();
    expect(readWithUnit("5 km", undefined)).toBeNull();
  });
});
