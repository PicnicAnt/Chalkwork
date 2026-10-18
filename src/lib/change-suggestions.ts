// What a suggested change would do to a board, in words. Pure, so it can be used on the server and
// in the browser.
import type { BoardDraft } from "./board-draft";
import { displayName } from "./formulas";

const show = (v: unknown) => (v === undefined || v === "" ? "none" : `"${String(v)}"`);

// "5" and 5, or 386.9512479 and 386.95124790000003, are the same value, not a change.
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  const [x, y] = [String(a).trim().replace(/,/g, ""), String(b).trim().replace(/,/g, "")];
  if (x === y) return true;
  const [n, m] = [Number(x), Number(y)];
  return x !== "" && y !== "" && Number.isFinite(n) && Number.isFinite(m) && Math.abs(n - m) <= 1e-9 * Math.max(1, Math.abs(n), Math.abs(m));
}

function compareMap<T>(
  out: string[],
  what: (name: string) => string,
  a: Record<string, T>,
  b: Record<string, T>,
  format: (value: T | undefined) => string = show,
) {
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    // A missing entry and an empty one say the same thing.
    if (same(a[name] ?? "", b[name] ?? "")) continue;
    out.push(`${what(displayName(name))}: ${format(a[name])} → ${format(b[name])}`);
  }
}

export function diffDrafts(base: BoardDraft, next: BoardDraft): string[] {
  const out: string[] = [];
  if (base.title !== next.title) out.push(`Title: ${show(base.title)} → ${show(next.title)}`);
  if (base.description !== next.description) out.push("Description changed");

  const had = new Set(base.formulas);
  const has = new Set(next.formulas);
  for (const f of base.formulas) if (!has.has(f)) out.push(`Formula removed: ${f}`);
  for (const f of next.formulas) if (!had.has(f)) out.push(`Formula added: ${f}`);

  const baseUse = new Map(base.includes.map((i) => [i.alias, i]));
  const nextUse = new Map(next.includes.map((i) => [i.alias, i]));
  for (const [alias, inc] of baseUse) {
    const now = nextUse.get(alias);
    if (!now || now.board !== inc.board) out.push(`Stops using a board as ${alias}`);
    else if ((now.name ?? "") !== (inc.name ?? "")) out.push(`Board ${alias} is now named ${show(now.name)}`);
    else if ((now.preset ?? "") !== (inc.preset ?? "")) out.push(`Board ${alias} ${now.preset ? `starts from the preset ${now.preset}` : "no longer starts from a preset"}`);
    else if ((now.group ?? "") !== (inc.group ?? "")) out.push(`Board ${alias} ${now.group ? `is now in the group ${now.group}` : "is no longer in a group"}`);
    else if ((now.version ?? 0) !== (inc.version ?? 0)) out.push(now.version ? `Board ${alias} is pinned to version ${now.version}` : `Board ${alias} follows the latest version`);
  }
  for (const [alias, inc] of nextUse) {
    const was = baseUse.get(alias);
    if (!was || was.board !== inc.board) out.push(`Uses another board as ${alias}`);
  }

  compareMap(out, (n) => `Starting value of ${n}`, base.values, next.values);
  compareMap(out, (n) => `Display name of ${n}`, base.labels, next.labels);
  compareMap(out, (n) => `Unit of ${n}`, base.units, next.units);
  compareMap(out, (n) => `Note on ${n}`, base.descriptions, next.descriptions);
  compareMap(out, (n) => `Type of ${n}`, base.types, next.types, (v) => (v === undefined ? "number" : v));
  if (base.visibility !== next.visibility) out.push(`Who can open it: ${base.visibility} → ${next.visibility}`);
  compareMap(out, (n) => `Options of ${n}`, base.choices, next.choices, (v) => (v === undefined ? "none" : (v as { label: string; value: number }[]).map((o) => `${o.label} = ${o.value}`).join(", ")));
  compareMap(out, (n) => `Number format of ${n}`, base.formats, next.formats, (v) => (v === undefined ? "as it comes" : v));
  compareMap(out, (n) => `Decimals of ${n}`, base.decimals, next.decimals, (v) => (v === undefined ? "automatic" : String(v)));
  const rangeText = (v: { min?: number; max?: number } | undefined) => (v ? `${v.min ?? "…"} to ${v.max ?? "…"}` : "none");
  compareMap(out, (n) => `Range of ${n}`, base.ranges, next.ranges, rangeText);
  // Only what is hidden counts: "not hidden" and no entry are the same.
  const hiddenOnly = (h: Record<string, boolean>) => Object.fromEntries(Object.entries(h).filter(([, v]) => v));
  compareMap(out, (n) => `${n} hidden`, hiddenOnly(base.hidden), hiddenOnly(next.hidden), (v) => (v ? "yes" : "no"));
  if (JSON.stringify(base.presets) !== JSON.stringify(next.presets)) out.push("Presets changed");
  if (JSON.stringify(base.collections) !== JSON.stringify(next.collections)) out.push("Collections changed");
  if (base.order.join(",") !== next.order.join(",")) out.push("Order of the variables changed");
  if (base.tags.join(",") !== next.tags.join(",")) out.push(`Tags: ${base.tags.join(", ") || "none"} → ${next.tags.join(", ") || "none"}`);
  if (JSON.stringify(base.tables) !== JSON.stringify(next.tables)) out.push("Tables changed");
  if (JSON.stringify(base.visualizations) !== JSON.stringify(next.visualizations)) out.push("Drawings changed");
  return out;
}

// Just the parts of a board that can be changed, without who owns it or when it was made.
export function draftOf(c: BoardDraft): BoardDraft {
  return {
    title: c.title,
    description: c.description,
    formulas: c.formulas,
    values: c.values,
    descriptions: c.descriptions,
    units: c.units,
    labels: c.labels,
    hidden: c.hidden,
    decimals: c.decimals,
    ranges: c.ranges,
    tables: c.tables,
    tags: c.tags,
    order: c.order,
    collections: c.collections,
    presets: c.presets,
    types: c.types,
    formats: c.formats,
    choices: c.choices,
    visibility: c.visibility,
    includes: c.includes,
    visualizations: c.visualizations,
  };
}

// One plain sentence about what a save changed, for the top of a history entry: counts and names, where the list under
// it gives every line. Returns "" when nothing that shows changed.
export function summarizeChanges(base: BoardDraft, next: BoardDraft): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const list = (names: string[]) => (names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`);
  const joined = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? ""));

  if (base.title !== next.title) parts.push(`renamed the board to ${show(next.title)}`);
  if (base.description !== next.description) parts.push("edited the description");

  // A formula is known by what it works out (the text before the =): a change to one is not a removal and an addition.
  const lhs = (f: string) => f.split("=")[0].trim();
  const before = new Map(base.formulas.map((f) => [lhs(f), f]));
  const after = new Map(next.formulas.map((f) => [lhs(f), f]));
  const added = [...after.keys()].filter((k) => !before.has(k)).length;
  const removed = [...before.keys()].filter((k) => !after.has(k)).length;
  const changed = [...after].filter(([k, f]) => before.has(k) && before.get(k) !== f).length;
  if (added) parts.push(`added ${plural(added, "formula")}`);
  if (changed) parts.push(`changed ${plural(changed, "formula")}`);
  if (removed) parts.push(`removed ${plural(removed, "formula")}`);

  const usedBefore = new Set(base.includes.map((i) => i.alias));
  const usedAfter = new Set(next.includes.map((i) => i.alias));
  const nowUsed = [...usedAfter].filter((a) => !usedBefore.has(a));
  const noLongerUsed = [...usedBefore].filter((a) => !usedAfter.has(a));
  if (nowUsed.length) parts.push(`started using ${plural(nowUsed.length, "board")}`);
  if (noLongerUsed.length) parts.push(`stopped using ${plural(noLongerUsed.length, "board")}`);

  const count = <T,>(a: Record<string, T>, b: Record<string, T>) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((n) => !same(a[n] ?? "", b[n] ?? "")).length;
  const values = count(base.values, next.values);
  if (values) parts.push(`changed ${plural(values, "starting value")}`);
  const names = count(base.labels, next.labels);
  if (names) parts.push(`renamed ${plural(names, "variable")}`);
  const units = count(base.units, next.units);
  if (units) parts.push(`changed ${plural(units, "unit")}`);
  const notes = count(base.descriptions, next.descriptions);
  if (notes) parts.push(`changed ${plural(notes, "note")}`);
  const ranges = count(base.ranges, next.ranges);
  if (ranges) parts.push(`changed ${plural(ranges, "range")}`);

  const presetNames = (d: BoardDraft) => d.presets.map((p) => p.name);
  const presetsAdded = presetNames(next).filter((n) => !presetNames(base).includes(n));
  const presetsRemoved = presetNames(base).filter((n) => !presetNames(next).includes(n));
  if (presetsAdded.length) parts.push(`added the ${presetsAdded.length === 1 ? "preset" : "presets"} ${list(presetsAdded)}`);
  if (presetsRemoved.length) parts.push(`removed the ${presetsRemoved.length === 1 ? "preset" : "presets"} ${list(presetsRemoved)}`);
  else if (!presetsAdded.length && JSON.stringify(base.presets) !== JSON.stringify(next.presets)) parts.push("changed a preset");

  const collectionNames = (d: BoardDraft) => d.collections.map((c) => c.name);
  const collectionsAdded = collectionNames(next).filter((n) => !collectionNames(base).includes(n));
  const collectionsRemoved = collectionNames(base).filter((n) => !collectionNames(next).includes(n));
  if (collectionsAdded.length) parts.push(`added the ${collectionsAdded.length === 1 ? "collection" : "collections"} ${list(collectionsAdded)}`);
  if (collectionsRemoved.length) parts.push(`removed the ${collectionsRemoved.length === 1 ? "collection" : "collections"} ${list(collectionsRemoved)}`);
  else if (!collectionsAdded.length && JSON.stringify(base.collections) !== JSON.stringify(next.collections)) parts.push("changed a collection");

  const drawingsBefore = base.visualizations.length;
  const drawingsAfter = next.visualizations.length;
  if (drawingsAfter > drawingsBefore) parts.push(`added ${plural(drawingsAfter - drawingsBefore, "drawing or chart", "drawings and charts")}`);
  else if (drawingsAfter < drawingsBefore) parts.push(`removed ${plural(drawingsBefore - drawingsAfter, "drawing or chart", "drawings and charts")}`);
  else if (JSON.stringify(base.visualizations) !== JSON.stringify(next.visualizations)) parts.push("changed a drawing or chart");

  if (JSON.stringify(base.tables) !== JSON.stringify(next.tables)) parts.push("changed a table");
  if (base.visibility !== next.visibility) parts.push(`made the board ${next.visibility}`);
  if (base.tags.join(",") !== next.tags.join(",")) parts.push("changed the tags");
  if (base.order.join(",") !== next.order.join(",")) parts.push("reordered the variables");

  if (parts.length === 0) return "";
  const shown = parts.length > 6 ? [...parts.slice(0, 6), "made other changes"] : parts;
  const sentence = joined(shown);
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}
