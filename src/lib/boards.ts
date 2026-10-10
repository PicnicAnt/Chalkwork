import { PATH_SEPARATOR, analyzeFormulas, humanize, isVariableName, tokenize } from "./formulas";
import type { Table } from "./tables";
import type { BundleVisualization, Visualization } from "./visualizations";

// Boards that use other boards.
//
// A board can include existing boards. Each included board is given an alias, and its variables
// join this board's variables under that alias: the variable inc_dmg of a board included as
// "weapon" is weapon.inc_dmg. Its formulas come along too, so they keep working, and anything can
// be linked with an equation, such as `weapon.dps = armor.damage_taken * 2` or
// `shield.value = my_variable`. Equations work in both directions, so linked variables follow each
// other whichever one is changed.
//
// Inside the maths a variable from an included board is written weapon$inc_dmg (mathjs allows a
// dollar sign in a name, and not a dot). People type and see the dot form.
//
// This file is plain logic with no database or browser code: it is used both by the server, when
// it loads and checks a board, and by the editor, to preview a board while it is being built.

/**
 * `name` is what the board is called here (so one board can be used twice, as player and as enemy); empty means its own title.
 * `group` makes the board an item in a collection: boards in the same group are summed (group.variable is the total of
 * variable over the items that are switched on, and each item gets an "equipped" switch).
 */
export type Include = {
  board: string;
  alias: string;
  name?: string;
  /** Pinned to this version of the board; without it the latest is used. */
  version?: number;
  group?: string;
  /** The name of one of that board's presets, whose values the board starts with here. */
  preset?: string;
};

// Everything one board contributes to a bigger system, with all its variables named in its own
// namespace (before any alias is put in front).
/** The values a variable is meant to stay within; either end can be left open. */
export type Range = { min?: number; max?: number };

/** What a variable holds: a number, or a yes/no (shown as a tick box; true is 1 and false is 0 in the maths). */
export type VarType = "number" | "boolean";

export type Bundle = {
  formulas: string[];
  values: Record<string, string>;
  descriptions: Record<string, string>;
  units: Record<string, string>;
  labels: Record<string, string>;
  hidden: Record<string, boolean>;
  decimals: Record<string, number>;
  ranges: Record<string, Range>;
  /** The type of a variable; a variable with no entry is a number. */
  types?: Record<string, VarType>;
  /** Lookup tables the formulas can call like functions. Those of a used board are named alias$table. */
  tables: Table[];
  /** The order variables are listed in, by name; those not named come after, in the order they appear. */
  order: string[];
  /**
   * Variables linked to another variable, by name. A link is an equation, `variable = other`, so
   * the two follow each other whichever one is changed. Meant for joining the variables of
   * different boards without writing the formula out.
   */
  links: Record<string, string>;
  /** The included boards behind the variables, by alias path (weapon, weapon$sub), for headings. */
  groups: Record<string, { title: string; board: string; /** The collection a used board is in, if any. */ collection?: string }>;
  /** The drawings of this board and of the boards it uses (those say which board they belong to). */
  visualizations: BundleVisualization[];
};

/**
 * A collection: a named group of items (boards) whose stats are added up. Items can be put in it by the board's creator
 * (an included board with that group) and by whoever uses the board. `stats` are the variables that are totalled; with
 * none listed, every variable the items have is.
 */
export type Collection = {
  name: string;
  stats: string[];
  /** The boards (by id) that can be added to it. With none listed, any board can. */
  boards?: string[];
};

export type OwnData = Omit<Bundle, "groups" | "visualizations"> & { visualizations: Visualization[]; collections?: Collection[] };

export type IncludedBundle = {
  alias: string;
  board: string;
  title: string;
  name?: string;
  /** The version it is pinned to, if it is. */
  version?: number;
  /** The collection it is an item of, if any. */
  group?: string;
  /** The preset of the board it starts from, if any, and the typed values of each preset the board has, by name. */
  preset?: string;
  presetValues?: Record<string, Record<string, string>>;
  /** The newest version of the board, to say when a pinned one is behind. */
  latest?: number;
  bundle: Bundle;
};

export const BOARD_LIMITS = { includes: 10, depth: 5, alias: 30, name: 60 };

// Why this can't be used as an alias, or null.
export function checkAlias(alias: string): string | null {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) return "Use letters, digits and underscores, starting with a letter";
  if (alias.length > BOARD_LIMITS.alias) return `At most ${BOARD_LIMITS.alias} characters`;
  if (!isVariableName(alias)) return `"${alias}" is a built-in name`;
  return null;
}

// Reads the list of included boards sent by the editor.
export function parseIncludes(raw: unknown): { includes: Include[]; errors: string[] } {
  const errors: string[] = [];
  const includes: Include[] = [];
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > BOARD_LIMITS.includes) errors.push(`At most ${BOARD_LIMITS.includes} boards can be used.`);
  const seen = new Set<string>();
  for (const item of list.slice(0, BOARD_LIMITS.includes)) {
    const board = typeof item?.board === "string" ? item.board.trim() : "";
    const alias = typeof item?.alias === "string" ? item.alias.trim() : "";
    const problem = checkAlias(alias);
    if (!board) errors.push("A board that is used is missing.");
    else if (problem) errors.push(`The name "${alias}" for a used board can't be used: ${problem}.`);
    else if (seen.has(alias)) errors.push(`Two used boards are both called "${alias}".`);
    else {
      seen.add(alias);
      const name = typeof item?.name === "string" ? item.name.trim().slice(0, BOARD_LIMITS.name) : "";
      const version = Number.isInteger(item?.version) && item.version >= 1 ? (item.version as number) : undefined;
      const group = typeof item?.group === "string" ? item.group.trim() : "";
      const preset = typeof item?.preset === "string" ? item.preset.trim().slice(0, 40) : "";
      const groupProblem = group ? checkAlias(group) : null;
      if (groupProblem) errors.push(`The group "${group}" can't be used: ${groupProblem}.`);
      includes.push({ board, alias, ...(name ? { name } : {}), ...(version ? { version } : {}), ...(group && !groupProblem ? { group } : {}), ...(preset ? { preset } : {}) });
    }
  }
  // A group can't have the name of a used board: both are written before a dot in formulas.
  for (const g of new Set(includes.flatMap((i) => (i.group ? [i.group] : [])))) {
    if (seen.has(g)) errors.push(`The group "${g}" has the same name as a used board.`);
  }
  return { includes, errors };
}

// Turns what was written (weapon.inc_dmg) into the form the maths uses (weapon$inc_dmg). A name
// that starts with something that isn't a used board is reported.
export function internalizeFormula(text: string, aliases: readonly string[]): { text: string; error?: string } {
  let error: string | undefined;
  const converted = tokenize(text)
    .map((t) => {
      if ((t.kind === "variable" || t.kind === "reserved") && t.text.includes(".")) {
        const first = t.text.split(".")[0];
        if (!aliases.includes(first)) error ??= `No board is used as "${first}". Add it under Boards first.`;
        return t.text.replaceAll(".", PATH_SEPARATOR);
      }
      return t.text;
    })
    .join("");
  return { text: converted, error };
}

const withAlias = (alias: string, name: string) => `${alias}${PATH_SEPARATOR}${name}`;

// The bundle of an included board, with every variable given the alias in front of its name.
export function prefixBundle(bundle: Bundle, alias: string): Bundle {
  const keys = <T>(record: Record<string, T>) =>
    Object.fromEntries(Object.entries(record).map(([name, value]) => [withAlias(alias, name), value]));
  const tableNames = new Set(bundle.tables.map((t) => t.name));
  return {
    formulas: bundle.formulas.map((formula) =>
      tokenize(formula)
        // A call to one of the board's tables follows the table to its new name.
        .map((t) => (t.kind === "variable" || (t.kind === "reserved" && tableNames.has(t.text)) ? withAlias(alias, t.text) : t.text))
        .join(""),
    ),
    tables: bundle.tables.map((t) => ({ ...t, name: withAlias(alias, t.name) })),
    order: bundle.order.map((n) => withAlias(alias, n)),
    values: keys(bundle.values),
    descriptions: keys(bundle.descriptions),
    units: keys(bundle.units),
    labels: keys(bundle.labels),
    hidden: keys(bundle.hidden),
    decimals: keys(bundle.decimals),
    ranges: keys(bundle.ranges),
    types: keys(bundle.types ?? {}),
    // A link joins two variables of the same board, so both ends get the alias.
    links: Object.fromEntries(
      Object.entries(bundle.links).map(([from, to]) => [withAlias(alias, from), withAlias(alias, to)]),
    ),
    groups: keys(bundle.groups),
    // A drawing of a used board follows that board's variables, and is shown with that board.
    visualizations: bundle.visualizations.map((v) => ({
      ...v,
      map: Object.fromEntries(Object.entries(v.map).map(([param, name]) => [param, withAlias(alias, name)])),
      lists: v.lists && Object.fromEntries(Object.entries(v.lists).map(([slot, names]) => [slot, names.map((name) => withAlias(alias, name))])),
      group: alias,
    })),
  };
}

export const AGGREGATES = ["sum", "avg", "min", "max"] as const;
export type Aggregate = (typeof AGGREGATES)[number];

/** A stat of a collection as written: "weight" (added up) or "damage:avg" (also :sum, :min, :max). */
export function parseStat(stat: string): { name: string; agg: Aggregate } {
  const [name, agg] = stat.split(":");
  return { name, agg: (AGGREGATES as readonly string[]).includes(agg) ? (agg as Aggregate) : "sum" };
}

// What a formula asked for with avg(parts.weight), min(...), max(...), sum(...) or count(parts).
export type AggregateNeed = { group: string; name: string | null; agg: Aggregate | "count" };

const FUNCTION_AGGREGATES: Record<string, Aggregate | "count"> = { sum: "sum", avg: "avg", mean: "avg", min: "min", max: "max", count: "count" };

// Formulas may write avg(parts.weight): the average of that variable over the boards in the collection that are
// switched on. It is replaced by the variable that holds it (parts.weight when the collection already works it out that
// way, parts.weight.avg otherwise), and the variable is asked for.
export function rewriteAggregates(formula: string, groups: ReadonlySet<string>, collections: readonly Collection[]): { text: string; needs: AggregateNeed[] } {
  const needs: AggregateNeed[] = [];
  const text = formula.replace(/\b(sum|avg|mean|min|max|count)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s*\.\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\)/g, (whole, fn: string, group: string, name?: string) => {
    if (!groups.has(group)) return whole;
    const agg = FUNCTION_AGGREGATES[fn];
    if (agg === "count") {
      if (name) return whole;
      needs.push({ group, name: null, agg });
      return `${group}.count`;
    }
    if (!name) return whole;
    const stats = (collections.find((c) => c.name === group)?.stats ?? []).map(parseStat);
    const declared = stats.find((s) => s.name === name)?.agg;
    // The variable the collection already makes: its stat as listed, or (with no list) the plain total.
    if (declared === agg || (stats.length === 0 && agg === "sum")) return `${group}.${name}`;
    needs.push({ group, name, agg });
    return `${group}.${name}.${agg}`;
  });
  return { text, needs };
}

// The formula for a total over the boards of a collection that are switched on. `terms` are the boards that have the
// variable, each with its Included switch and its value. Nothing included gives 0, so formulas that use it still work.
function aggregateFormula(agg: Aggregate | "count", terms: { on: string; value: string }[]): string {
  if (terms.length === 0) return "0";
  const sum = terms.map((t) => `${t.on} * ${t.value}`).join(" + ");
  const n = terms.map((t) => t.on).join(" + ");
  switch (agg) {
    case "count":
      return n;
    case "sum":
      return sum;
    case "avg":
      return `if((${n}) > 0, (${sum}) / (${n}), 0)`;
    case "min":
      return `if((${n}) > 0, min(${terms.map((t) => `if(${t.on} > 0, ${t.value}, 1e300)`).join(", ")}), 0)`;
    case "max":
      return `if((${n}) > 0, max(${terms.map((t) => `if(${t.on} > 0, ${t.value}, -1e300)`).join(", ")}), 0)`;
  }
}

// The collections of a board: for each group of boards, a total of every variable it asks for, and for each board a
// switch (alias.equipped, 1 or 0) that takes it in or leaves it out of the totals. They are ordinary variables and
// formulas, so the totals work in any direction like everything else.
function groupSums(included: readonly IncludedBundle[], collections: readonly Collection[] = [], needs: readonly AggregateNeed[] = [], referenced: ReadonlyMap<string, ReadonlySet<string>> = new Map()) {
  const out = {
    names: [] as string[],
    formulas: [] as string[],
    values: {} as Record<string, string>,
    descriptions: {} as Record<string, string>,
    units: {} as Record<string, string>,
    labels: {} as Record<string, string>,
    decimals: {} as Record<string, number>,
    ranges: {} as Record<string, Range>,
    types: {} as Record<string, VarType>,
    groups: {} as Record<string, { title: string; board: string }>,
  };
  const byGroup = new Map<string, IncludedBundle[]>();
  for (const c of collections) byGroup.set(c.name, []);
  for (const i of included) if (i.group) byGroup.set(i.group, [...(byGroup.get(i.group) ?? []), i]);
  for (const [group, items] of byGroup) {
    out.names.push(group);
    out.groups[group] = { title: humanize(group), board: "" };
    const owned = items.map((i) => ({
      item: i,
      names: analyzeFormulas(i.bundle.formulas, i.bundle.tables)
        .variables.map((v) => v.name)
        .filter((n) => !n.includes(PATH_SEPARATOR) && n !== "equipped" && i.bundle.hidden[n] !== true),
    }));
    for (const { item } of owned) {
      const key = withAlias(item.alias, "equipped");
      out.values[key] = "1";
      out.labels[key] = "Included";
      out.descriptions[key] = "1 counts this board in the totals, 0 leaves it out.";
      out.decimals[key] = 0;
      out.ranges[key] = { min: 0, max: 1 };
      out.types[key] = "boolean";
    }
    const termsFor = (name: string) =>
      owned.filter((o) => o.names.includes(name)).map((o) => ({ on: withAlias(o.item.alias, "equipped"), value: withAlias(o.item.alias, name), bundle: o.item.bundle }));
    const describe = (target: string, name: string, bundle: Bundle | undefined, suffix: string) => {
      out.labels[target] = `${bundle?.labels[name] || humanize(name)}${suffix}`;
      if (bundle?.units[name]) out.units[target] = bundle.units[name];
      if (bundle?.decimals[name] !== undefined) out.decimals[target] = bundle.decimals[name];
    };

    const declared = (collections.find((c) => c.name === group)?.stats ?? []).map(parseStat);
    // The variables that get a total: those listed (older boards), every variable the boards have, and those formulas use.
    const listed = [...declared];
    // (A collection that lists its variables, as older boards do, only totals those and the ones formulas use.)
    for (const name of [...(declared.length === 0 ? owned.flatMap((o) => o.names) : []), ...(referenced.get(group) ?? [])]) {
      if (!listed.some((l) => l.name === name)) listed.push({ name, agg: "sum" });
    }
    for (const { name, agg } of listed) {
      const terms = termsFor(name);
      const total = withAlias(group, name);
      out.formulas.push(`${total} = ${aggregateFormula(agg, terms)}`);
      describe(total, name, terms[0]?.bundle, agg === "sum" ? "" : ` (${agg})`);
    }

    // What formulas asked for beyond that, such as avg(group.variable) when the collection adds the variable up.
    const done = new Set<string>();
    for (const need of needs.filter((n) => n.group === group)) {
      const key = `${need.name ?? ""}:${need.agg}`;
      if (done.has(key)) continue;
      done.add(key);
      if (need.agg === "count" || need.name === null) {
        out.formulas.push(`${withAlias(group, "count")} = ${owned.length ? owned.map((o) => withAlias(o.item.alias, "equipped")).join(" + ") : "0"}`);
        out.labels[withAlias(group, "count")] = "Number of boards";
        out.decimals[withAlias(group, "count")] = 0;
        continue;
      }
      const terms = termsFor(need.name);
      const target = `${withAlias(group, need.name)}${PATH_SEPARATOR}${need.agg}`;
      out.formulas.push(`${target} = ${aggregateFormula(need.agg, terms)}`);
      describe(target, need.name, terms[0]?.bundle, ` (${need.agg})`);
    }
  }
  return out;
}

// A board's own data plus the boards it includes, as one system of formulas. What a board sets
// itself wins over what an included board says about the same variable (its starting value, label,
// unit, note, decimals or hidden flag), so a board can restyle what it borrows.
export function flatten(
  own: OwnData,
  included: readonly IncludedBundle[],
): { bundle: Bundle; ownErrors: { index: number; message: string }[] } {
  // Boards put in a collection are added up: group.variable is the total over the boards that are switched on, or the
  // average, minimum or maximum when the collection says so or the formula asks (avg(group.variable)).
  const collections = own.collections ?? [];
  const groupNames = new Set([...collections.map((c) => c.name), ...included.flatMap((i) => (i.group ? [i.group] : []))]);
  const needs: AggregateNeed[] = [];
  const rewritten = own.formulas.map((formula) => {
    const out = rewriteAggregates(formula, groupNames, collections);
    needs.push(...out.needs);
    return out.text;
  });
  // Every collection.variable a formula mentions is a total, even when no board has the variable yet (then it is 0).
  const referenced = new Map<string, Set<string>>();
  for (const formula of rewritten) {
    for (const m of formula.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*\.)/g)) {
      if (groupNames.has(m[1]) && m[2] !== "count") referenced.set(m[1], new Set([...(referenced.get(m[1]) ?? []), m[2]]));
    }
  }
  const sums = groupSums(included, collections, needs, referenced);
  const aliases = [...included.map((i) => i.alias), ...sums.names];
  const ownErrors: { index: number; message: string }[] = [];
  const ownFormulas = rewritten.map((formula, index) => {
    const { text, error } = internalizeFormula(formula, aliases);
    if (error) ownErrors.push({ index, message: error });
    return text;
  });

  // A board used from one of its presets starts with that preset's typed values.
  const startingFrom = (i: IncludedBundle): Bundle => {
    const typed = i.preset ? i.presetValues?.[i.preset] : undefined;
    return typed ? { ...i.bundle, values: { ...i.bundle.values, ...typed } } : i.bundle;
  };
  const parts = included.map((i) => ({ i, bundle: prefixBundle(startingFrom(i), i.alias) }));
  const merge = <T>(pick: (b: Bundle) => Record<string, T>, ownMap: Record<string, T>): Record<string, T> =>
    Object.assign({}, ...parts.map((p) => pick(p.bundle)), ownMap);

  // This board's own links become equations. The links of used boards are already equations in
  // their formulas, so only their record is carried along (for showing).
  const linkFormulas = linkEquations(own.links);

  return {
    ownErrors,
    bundle: {
      // Order matters: this board's formulas, then its links, then the used boards' formulas. The
      // editor relies on it to tell which of the three a problem belongs to.
      formulas: [...ownFormulas, ...linkFormulas, ...parts.flatMap((p) => p.bundle.formulas), ...sums.formulas],
      links: merge((b) => b.links, own.links),
      values: { ...sums.values, ...merge((b) => b.values, own.values) },
      descriptions: { ...sums.descriptions, ...merge((b) => b.descriptions, own.descriptions) },
      units: { ...sums.units, ...merge((b) => b.units, own.units) },
      labels: { ...sums.labels, ...merge((b) => b.labels, own.labels) },
      hidden: merge((b) => b.hidden, own.hidden),
      decimals: { ...sums.decimals, ...merge((b) => b.decimals, own.decimals) },
      ranges: { ...sums.ranges, ...merge((b) => b.ranges, own.ranges) },
      types: { ...sums.types, ...merge((b) => b.types ?? {}, own.types ?? {}) },
      tables: [...own.tables, ...parts.flatMap((p) => p.bundle.tables)],
      order: [...own.order, ...parts.flatMap((p) => p.bundle.order)],
      visualizations: [...own.visualizations, ...parts.flatMap((p) => p.bundle.visualizations)],
      groups: Object.assign(
        {},
        ...parts.map((p) => ({ ...p.bundle.groups, [p.i.alias]: { title: p.i.name || p.i.title, board: p.i.board, ...(p.i.group ? { collection: p.i.group } : {}) } })),
        sums.groups,
      ),
    },
  };
}

// A link as the equation it stands for.
export const linkEquations = (links: Record<string, string>) => Object.entries(links).map(([from, to]) => `${from} = ${to}`);

// A variable is renamed: links from it and to it follow.
export function renameLinks(links: Record<string, string>, from: string, to: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(links).map(([a, b]) => [a === from ? to : a, b === from ? to : b]),
  );
}

// A used board's alias is renamed: links with an end in that board follow.
export function renameAliasLinks(links: Record<string, string>, from: string, to: string): Record<string, string> {
  const prefix = `${from}${PATH_SEPARATOR}`;
  const move = (name: string) => (name.startsWith(prefix) ? `${to}${PATH_SEPARATOR}${name.slice(prefix.length)}` : name);
  return Object.fromEntries(Object.entries(links).map(([a, b]) => [move(a), move(b)]));
}

// A used board is removed: links with an end in that board go with it.
export function dropAliasLinks(links: Record<string, string>, alias: string): Record<string, string> {
  const prefix = `${alias}${PATH_SEPARATOR}`;
  return Object.fromEntries(Object.entries(links).filter(([a, b]) => !a.startsWith(prefix) && !b.startsWith(prefix)));
}

// The top-level alias a variable belongs to ("weapon" for weapon$sub$x), or null for the board's own.
export function groupOf(name: string): string | null {
  const at = name.indexOf(PATH_SEPARATOR);
  return at < 0 ? null : name.slice(0, at);
}

// Changes the alias a used board goes by, in formulas that mention it and in the settings kept per variable.
export function renameAliasInText(text: string, from: string, to: string): string {
  return tokenize(text)
    .map((t) => {
      if ((t.kind === "variable" || t.kind === "reserved") && t.text.startsWith(`${from}.`)) {
        return `${to}${t.text.slice(from.length)}`;
      }
      return t.text;
    })
    .join("");
}

export function renameAliasKeys<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  const prefix = `${from}${PATH_SEPARATOR}`;
  return Object.fromEntries(
    Object.entries(record).map(([name, value]) => [name.startsWith(prefix) ? `${to}${PATH_SEPARATOR}${name.slice(prefix.length)}` : name, value]),
  );
}

// A first alias for a board from its title: "Attack DPS" -> attack_dps, made unique and valid.
export function defaultAlias(title: string, taken: readonly string[]): string {
  let base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20)
    .replace(/_+$/g, "");
  if (!base) base = "board";
  if (/^[0-9]/.test(base)) base = `b_${base}`;
  if (!isVariableName(base)) base = `${base}_board`;
  let alias = base;
  for (let n = 2; taken.includes(alias); n++) alias = `${base}_${n}`;
  return alias;
}

// The board's own variables first, then those of each board it uses, in the order the boards are used.
// Used by every place that lists variables under the board they come from. `groups` is the bundle's.
export function sectionsByBoard<T extends { name: string }>(
  variables: readonly T[],
  groups: Record<string, unknown>,
  order: readonly string[] = [],
): { key: string | null; variables: T[] }[] {
  const boards = Object.keys(groups).filter((key) => !key.includes(PATH_SEPARATOR));
  // Variables named in `order` come first, in that order; the rest keep the order they appear in.
  const place = (name: string) => {
    const i = order.indexOf(name);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = (list: T[]) => (order.length === 0 ? list : [...list].sort((a, b) => place(a.name) - place(b.name)));
  return [
    { key: null as string | null, variables: sorted(variables.filter((v) => !boards.includes(groupOf(v.name) ?? ""))) },
    ...boards.map((key) => ({ key, variables: sorted(variables.filter((v) => groupOf(v.name) === key)) })),
  ].filter((section) => section.variables.length > 0);
}
