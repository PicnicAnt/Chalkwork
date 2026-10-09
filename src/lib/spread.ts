// How uncertain a result is: the inputs are drawn at random within their ranges, the board is solved for each draw,
// and the results are counted. Plain logic, so it is the same on the server and in the browser and can be tested.

/** A small seeded generator, so the same board draws the same picture every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number between min and max, most likely near `mode` (a triangular distribution); u is a draw from 0 to 1. */
export function triangular(min: number, mode: number, max: number, u: number): number {
  if (max <= min) return min;
  const c = Math.min(max, Math.max(min, mode));
  const cut = (c - min) / (max - min);
  return u < cut ? min + Math.sqrt(u * (max - min) * (c - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - c));
}

export type Spread = {
  count: number;
  mean: number;
  /** The values below which 5%, half and 95% of the results fall. */
  p5: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  /** How many results fall in each of the equal slices from min to max. */
  bins: number[];
};

export function summarize(results: number[], binCount = 20): Spread | null {
  const sorted = results.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const [min, max] = [sorted[0], sorted[sorted.length - 1]];
  const bins = new Array<number>(binCount).fill(0);
  for (const v of sorted) bins[max === min ? 0 : Math.min(binCount - 1, Math.floor(((v - min) / (max - min)) * binCount))]++;
  return { count: sorted.length, mean: sorted.reduce((s, v) => s + v, 0) / sorted.length, p5: at(0.05), p50: at(0.5), p95: at(0.95), min, max, bins };
}
