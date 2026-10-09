import { describe, expect, it } from "vitest";
import { seededRandom, summarize, triangular } from "@/lib/spread";

describe("spread of a result", () => {
  it("draws the same numbers for the same seed", () => {
    const [a, b] = [seededRandom(7), seededRandom(7)];
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("keeps triangular draws inside the range and centred on the likeliest value", () => {
    const rand = seededRandom(1);
    const draws = Array.from({ length: 4000 }, () => triangular(0, 2, 10, rand()));
    expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...draws)).toBeLessThanOrEqual(10);
    // The mean of a triangle is (min + mode + max) / 3 = 4.
    expect(draws.reduce((s, v) => s + v, 0) / draws.length).toBeCloseTo(4, 0);
    expect(triangular(5, 5, 5, 0.5)).toBe(5);
    expect(triangular(0, 20, 10, 0.99)).toBeLessThanOrEqual(10);
  });

  it("counts results into slices and finds the percentiles", () => {
    const s = summarize(Array.from({ length: 100 }, (_, i) => i + 1), 10)!;
    expect(s.count).toBe(100);
    expect(s.min).toBe(1);
    expect(s.max).toBe(100);
    expect(s.p50).toBe(51);
    expect(s.bins).toHaveLength(10);
    expect(s.bins.reduce((a, b) => a + b, 0)).toBe(100);
    expect(summarize([])).toBeNull();
    expect(summarize([3, 3, 3])!.bins[0]).toBe(3);
  });
});
