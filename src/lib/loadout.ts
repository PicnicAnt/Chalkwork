import type { ExtraItem } from "./resolve-boards";

// The best loadout finder tries sets of pieces: for each collection, a number of its pieces (each a board, or a preset
// of one) taken from what the collection lists. Plain logic, so it is easy to test.

export const MAX_COMBINATIONS = 240;

/** Every way to take `k` of `items`, in the order they are listed, each piece at most once. */
export function choose<T>(items: readonly T[], k: number): T[][] {
  if (k <= 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const walk = (from: number, taken: T[]) => {
    if (taken.length === k) {
      out.push(taken);
      return;
    }
    for (let i = from; i <= items.length - (k - taken.length); i++) walk(i + 1, [...taken, items[i]]);
  };
  walk(0, []);
  return out;
}

/** How many sets there would be, without making them. */
export function countCombinations(sizes: readonly { options: number; take: number }[]): number {
  let total = 1;
  for (const { options, take } of sizes) {
    if (take > options) return 0;
    let ways = 1;
    for (let i = 0; i < take; i++) ways = (ways * (options - i)) / (i + 1);
    total *= Math.round(ways);
    if (total > 1e9) return total;
  }
  return total;
}

/** Every set that takes `take[group]` pieces from each group's options, as the items to add to the board. */
export function loadouts(groups: readonly { group: string; options: ExtraItem[]; take: number }[]): ExtraItem[][] {
  let sets: ExtraItem[][] = [[]];
  for (const g of groups) {
    const picks = choose(g.options, g.take);
    sets = sets.flatMap((set) => picks.map((pick) => [...set, ...pick]));
  }
  return sets;
}
