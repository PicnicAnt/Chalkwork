"use server";

import { getCurrentUser } from "@/lib/auth";
import { getBoard } from "@/lib/db";
import { compute, initialLocks } from "@/lib/calculator";
import { analyzeFormulas, formatDecimals, parseValue } from "@/lib/formulas";
import { countCombinations, loadouts, MAX_COMBINATIONS } from "@/lib/loadout";
import { resolveForView, type ExtraItem } from "@/lib/resolve-boards";
import { getVisibleBoard } from "@/lib/visible-board";
import { canOpen } from "@/lib/visibility";

// "Find the best loadout": tries sets of pieces from a board's collections and says which come out best for one result.
// It works on the server because every set is another board to solve. Only collections that list their boards can be
// searched (the pieces are those boards and their presets).

export type LoadoutRequest = {
  goal: string;
  maximize: boolean;
  /** How many pieces to take from each collection. */
  take: Record<string, number>;
  /** What is typed on the board now, and which of it is locked: kept while the pieces are tried. */
  values: Record<string, string>;
  locked: string[];
};

export type LoadoutFound = { items: ExtraItem[]; titles: string[]; value: number; shown: string };
export type LoadoutResult = { ok: true; tried: number; results: LoadoutFound[]; goalLabel: string } | { ok: false; error: string };

// A slow search should not be started over and over: a few a minute for each person (or for everyone not signed in).
const recent = new Map<string, number[]>();
function tooOften(who: string): boolean {
  const now = Date.now();
  const list = (recent.get(who) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  recent.set(who, list);
  return list.length > 6;
}

export async function findBestLoadout(boardId: string, request: unknown): Promise<LoadoutResult> {
  const user = await getCurrentUser();
  if (tooOften(user?.id ?? "anyone")) return { ok: false, error: "Searching a lot at once. Try again in a minute." };
  const board = typeof boardId === "string" ? await getVisibleBoard(boardId) : null;
  if (!board) return { ok: false, error: "That board doesn't exist." };
  const r = (typeof request === "object" && request !== null ? request : {}) as Partial<LoadoutRequest>;
  const goal = typeof r.goal === "string" ? r.goal : "";
  const take = typeof r.take === "object" && r.take !== null ? (r.take as Record<string, unknown>) : {};
  const typed = typeof r.values === "object" && r.values !== null ? (r.values as Record<string, unknown>) : {};
  const locked = Array.isArray(r.locked) ? r.locked.filter((n): n is string => typeof n === "string" && !n.includes("$")) : [];

  // The pieces of each collection that was asked for: the boards it lists, each as itself or as one of its presets.
  const groups: { group: string; options: ExtraItem[]; take: number; titles: string[] }[] = [];
  for (const c of board.collections) {
    const n = Math.floor(Number(take[c.name]));
    if (!Number.isFinite(n) || n <= 0) continue;
    const options: ExtraItem[] = [];
    const titles: string[] = [];
    for (const id of c.boards ?? []) {
      const b = getBoard(id);
      if (!b || b.id === board.id || !canOpen(b, user?.id)) continue;
      if (b.presets.length === 0) {
        options.push({ group: c.name, board: id });
        titles.push(b.title);
      }
      for (const p of b.presets) {
        options.push({ group: c.name, board: id, preset: p.name });
        titles.push(`${b.title} · ${p.name}`);
      }
    }
    if (options.length === 0) return { ok: false, error: `${c.name} doesn't list the boards it takes, so there is nothing to choose from.` };
    groups.push({ group: c.name, options, take: Math.min(n, 6), titles });
  }
  if (groups.length === 0) return { ok: false, error: "Choose how many pieces to take from at least one collection." };
  const count = countCombinations(groups.map((g) => ({ options: g.options.length, take: g.take })));
  if (count === 0) return { ok: false, error: "A collection has fewer pieces than you asked for." };
  if (count > MAX_COMBINATIONS) return { ok: false, error: `That would be ${count} sets to try; the most is ${MAX_COMBINATIONS}. Take fewer pieces.` };

  const titleOf = new Map(groups.flatMap((g) => g.options.map((o, i) => [`${o.group}:${o.board}:${o.preset ?? ""}`, g.titles[i]] as const)));
  const found: LoadoutFound[] = [];
  let goalLabel = goal;
  for (const items of loadouts(groups)) {
    const resolved = resolveForView(board, items);
    if ("error" in resolved) return { ok: false, error: resolved.error };
    const { bundle } = resolved;
    const analysis = analyzeFormulas(bundle.formulas, bundle.tables);
    if (!analysis.variables.some((v) => v.name === goal)) return { ok: false, error: "Choose which result to make the best." };
    goalLabel = bundle.labels[goal] || goal;
    const keep = locked.filter((n) => typeof typed[n] === "string" && analysis.variables.some((v) => v.name === n));
    const values = { ...bundle.values, ...Object.fromEntries(keep.map((n) => [n, String(typed[n])])) };
    const out = compute(analysis, values, [...keep, ...initialLocks(analysis, values).filter((n) => !keep.includes(n))]);
    if (out.plan.held.includes(goal)) return { ok: false, error: `${goalLabel} is fixed by a locked value, so it can't change. Unlock what it depends on.` };
    const value = parseValue(out.display[goal]);
    if (value === undefined || !Number.isFinite(value)) continue;
    const places = bundle.decimals[goal];
    found.push({ items, titles: items.map((i) => titleOf.get(`${i.group}:${i.board}:${i.preset ?? ""}`) ?? i.board), value, shown: places !== undefined ? formatDecimals(value, places) : String(Number(value.toPrecision(6))) });
  }
  found.sort((a, b) => (r.maximize === false ? a.value - b.value : b.value - a.value));
  return { ok: true, tried: count, results: found.slice(0, 5), goalLabel };
}
