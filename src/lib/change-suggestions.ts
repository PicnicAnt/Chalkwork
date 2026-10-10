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
  compareMap(out, (n) => `Decimals of ${n}`, base.decimals, next.decimals, (v) => (v === undefined ? "automatic" : String(v)));
  const rangeText = (v: { min?: number; max?: number } | undefined) => (v ? `${v.min ?? "…"} to ${v.max ?? "…"}` : "none");
  compareMap(out, (n) => `Range of ${n}`, base.ranges ?? {}, next.ranges ?? {}, rangeText);
  // Only what is hidden counts: "not hidden" and no entry are the same.
  const hiddenOnly = (h: Record<string, boolean>) => Object.fromEntries(Object.entries(h).filter(([, v]) => v));
  compareMap(out, (n) => `${n} hidden`, hiddenOnly(base.hidden), hiddenOnly(next.hidden), (v) => (v ? "yes" : "no"));
  compareMap(out, (n) => `Link of ${n}`, base.links, next.links, (v) => (v === undefined ? "none" : displayName(v)));
  if ((base.order ?? []).join(",") !== (next.order ?? []).join(",")) out.push("Order of the variables changed");
  if ((base.tags ?? []).join(",") !== (next.tags ?? []).join(",")) out.push(`Tags: ${(base.tags ?? []).join(", ") || "none"} → ${(next.tags ?? []).join(", ") || "none"}`);
  if (JSON.stringify(base.tables ?? []) !== JSON.stringify(next.tables ?? [])) out.push("Tables changed");
  if (JSON.stringify(base.visualizations ?? []) !== JSON.stringify(next.visualizations ?? [])) out.push("Drawings changed");
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
    includes: c.includes,
    links: c.links,
    visualizations: c.visualizations,
  };
}
