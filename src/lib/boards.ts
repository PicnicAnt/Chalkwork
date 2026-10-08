import { PATH_SEPARATOR, isVariableName, tokenize } from "./formulas";
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

/** `name` is what the board is called here (so one board can be used twice, as player and as enemy); empty means its own title. */
export type Include = { board: string; alias: string; name?: string };

// Everything one board contributes to a bigger system, with all its variables named in its own
// namespace (before any alias is put in front).
export type Bundle = {
  formulas: string[];
  values: Record<string, string>;
  descriptions: Record<string, string>;
  units: Record<string, string>;
  labels: Record<string, string>;
  hidden: Record<string, boolean>;
  decimals: Record<string, number>;
  /**
   * Variables linked to another variable, by name. A link is an equation, `variable = other`, so
   * the two follow each other whichever one is changed. Meant for joining the variables of
   * different boards without writing the formula out.
   */
  links: Record<string, string>;
  /** The included boards behind the variables, by alias path (weapon, weapon$sub), for headings. */
  groups: Record<string, { title: string; board: string }>;
  /** The drawings of this board and of the boards it uses (those say which board they belong to). */
  visualizations: BundleVisualization[];
};

export type OwnData = Omit<Bundle, "groups" | "visualizations"> & { visualizations: Visualization[] };

export type IncludedBundle = { alias: string; board: string; title: string; name?: string; bundle: Bundle };

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
      includes.push(name ? { board, alias, name } : { board, alias });
    }
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
  return {
    formulas: bundle.formulas.map((formula) =>
      tokenize(formula)
        .map((t) => (t.kind === "variable" ? withAlias(alias, t.text) : t.text))
        .join(""),
    ),
    values: keys(bundle.values),
    descriptions: keys(bundle.descriptions),
    units: keys(bundle.units),
    labels: keys(bundle.labels),
    hidden: keys(bundle.hidden),
    decimals: keys(bundle.decimals),
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

// A board's own data plus the boards it includes, as one system of formulas. What a board sets
// itself wins over what an included board says about the same variable (its starting value, label,
// unit, note, decimals or hidden flag), so a board can restyle what it borrows.
export function flatten(
  own: OwnData,
  included: readonly IncludedBundle[],
): { bundle: Bundle; ownErrors: { index: number; message: string }[] } {
  const aliases = included.map((i) => i.alias);
  const ownErrors: { index: number; message: string }[] = [];
  const ownFormulas = own.formulas.map((formula, index) => {
    const { text, error } = internalizeFormula(formula, aliases);
    if (error) ownErrors.push({ index, message: error });
    return text;
  });

  const parts = included.map((i) => ({ i, bundle: prefixBundle(i.bundle, i.alias) }));
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
      formulas: [...ownFormulas, ...linkFormulas, ...parts.flatMap((p) => p.bundle.formulas)],
      links: merge((b) => b.links, own.links),
      values: merge((b) => b.values, own.values),
      descriptions: merge((b) => b.descriptions, own.descriptions),
      units: merge((b) => b.units, own.units),
      labels: merge((b) => b.labels, own.labels),
      hidden: merge((b) => b.hidden, own.hidden),
      decimals: merge((b) => b.decimals, own.decimals),
      visualizations: [...own.visualizations, ...parts.flatMap((p) => p.bundle.visualizations)],
      groups: Object.assign(
        {},
        ...parts.map((p) => ({ ...p.bundle.groups, [p.i.alias]: { title: p.i.name || p.i.title, board: p.i.board } })),
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
