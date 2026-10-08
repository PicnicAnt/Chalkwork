// What a suggested change would do to a board, in words. Pure, so it can be used on the server and
// in the browser.
import type { CalculationDraft } from "./calculation";
import { displayName } from "./formulas";

const show = (v: unknown) => (v === undefined || v === "" ? "none" : `"${String(v)}"`);

function compareMap<T>(
  out: string[],
  what: (name: string) => string,
  a: Record<string, T>,
  b: Record<string, T>,
  format: (value: T | undefined) => string = show,
) {
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[name]) === JSON.stringify(b[name])) continue;
    out.push(`${what(displayName(name))}: ${format(a[name])} → ${format(b[name])}`);
  }
}

export function diffDrafts(base: CalculationDraft, next: CalculationDraft): string[] {
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
  compareMap(out, (n) => `${n} hidden`, base.hidden, next.hidden, (v) => (v ? "yes" : "no"));
  compareMap(out, (n) => `Link of ${n}`, base.links, next.links, (v) => (v === undefined ? "none" : displayName(v)));
  return out;
}

// Just the parts of a board that can be changed, without who owns it or when it was made.
export function draftOf(c: CalculationDraft): CalculationDraft {
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
    includes: c.includes,
    links: c.links,
  };
}
