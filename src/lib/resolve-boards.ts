import "server-only";
import { BOARD_LIMITS, flatten, type Bundle, type Include, type IncludedBundle, type OwnData } from "./boards";
import type { Board } from "./board-draft";
import { getBoard, getVersion, latestVersion } from "./db";
import { presetValues } from "./scenarios";

// Loading the boards a board uses. Boards use boards by id and are read when needed, so a change to
// a used board shows up in every board that uses it. The two things that can go wrong are boards
// using each other in a loop, and a chain so deep or wide that loading it would be a burden.

const MAX_BOARDS_LOADED = 60;

type Budget = { left: number };
type Failure = { error: string };

const ownData = (calc: Board): OwnData => ({
  formulas: calc.formulas,
  values: calc.values,
  descriptions: calc.descriptions,
  units: calc.units,
  labels: calc.labels,
  hidden: calc.hidden,
  decimals: calc.decimals,
  ranges: calc.ranges,
  tables: calc.tables,
  order: calc.order ?? [],
  collections: calc.collections ?? [],
  links: calc.links,
  visualizations: calc.visualizations,
});

// What one board brings along: its own formulas and settings plus, in turn, the boards it uses.
// `visiting` is the boards on the way down, which is how a loop is noticed.
function bundleOf(
  boardId: string,
  visiting: readonly string[],
  budget: Budget,
  version?: number,
): { title: string; bundle: Bundle } | Failure {
  if (visiting.includes(boardId)) return { error: "Boards can't use each other in a loop." };
  if (visiting.length >= BOARD_LIMITS.depth) {
    return { error: `Boards can only use other boards ${BOARD_LIMITS.depth} levels deep.` };
  }
  if (--budget.left < 0) return { error: "That is too many boards to load at once." };
  const current = getBoard(boardId);
  if (!current) return { error: "A board that is used no longer exists." };
  // A pinned board is the saved version, with the board's own title.
  let calc: Board = current;
  if (version) {
    const saved = getVersion(boardId, version);
    if (!saved) return { error: `Version ${version} of "${current.title}" doesn't exist.` };
    calc = { ...current, ...saved };
  }

  const resolved = resolveWithBudget(calc.includes, [...visiting, boardId], budget);
  if ("error" in resolved) return resolved;
  return { title: current.title, bundle: flatten(ownData(calc), resolved.included).bundle };
}

function resolveWithBudget(
  includes: readonly Include[],
  visiting: readonly string[],
  budget: Budget,
): { included: IncludedBundle[] } | Failure {
  const included: IncludedBundle[] = [];
  for (const inc of includes) {
    const found = bundleOf(inc.board, visiting, budget, inc.version);
    if ("error" in found) return found;
    const presets = getBoard(inc.board)?.presets ?? [];
    included.push({ alias: inc.alias, board: inc.board, title: found.title, name: inc.name, version: inc.version, group: inc.group, preset: inc.preset, presetValues: Object.fromEntries(presets.map((p) => [p.name, presetValues(p)])), latest: latestVersion(inc.board), bundle: found.bundle });
  }
  return { included };
}

// The boards a board uses, loaded. `selfId` is the board being edited, which none of them may use,
// directly or through other boards.
export function resolveIncludes(
  includes: readonly Include[],
  selfId?: string,
): { included: IncludedBundle[] } | Failure {
  if (selfId && includes.some((i) => i.board === selfId)) return { error: "A board can't use itself." };
  return resolveWithBudget(includes, selfId ? [selfId] : [], { left: MAX_BOARDS_LOADED });
}

// One board, loaded so it can be added to another.
export function resolveBoard(boardId: string, selfId?: string, version?: number): { title: string; latest: number; bundle: Bundle } | Failure {
  if (selfId && boardId === selfId) return { error: "A board can't use itself." };
  const found = bundleOf(boardId, selfId ? [selfId] : [], { left: MAX_BOARDS_LOADED }, version);
  return "error" in found ? found : { ...found, latest: latestVersion(boardId) };
}

// A board together with the boards it uses, as the one system of formulas to show.
// An item someone using the board added to one of its collections (it is not saved on the board).
export type ExtraItem = { group: string; board: string; preset?: string };

// The groups a board has: its collections, and those its creator put included boards in.
export const groupsOf = (calc: Board): string[] => [...new Set([...(calc.collections ?? []).map((c) => c.name), ...calc.includes.flatMap((i) => (i.group ? [i.group] : []))])];

export function resolveForView(calc: Board, extras: readonly ExtraItem[] = []): { bundle: Bundle } | Failure {
  const groups = groupsOf(calc);
  const taken = new Set(calc.includes.map((i) => i.alias));
  const added: Include[] = extras
    .filter((e) => groups.includes(e.group) && e.board !== calc.id)
    .map((e, n) => {
      let alias = `item${n + 1}`;
      while (taken.has(alias)) alias += "_";
      taken.add(alias);
      return { board: e.board, alias, group: e.group, ...(e.preset ? { preset: e.preset } : {}) };
    });
  const resolved = resolveIncludes([...calc.includes, ...added], calc.id);
  if ("error" in resolved) return resolved;
  return { bundle: flatten(ownData(calc), resolved.included).bundle };
}
