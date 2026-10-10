// Shared types and validation for calculations. Safe to import from client and server.
import { parseTags } from "./tags";
import { parseTables, type Table } from "./tables";
import { checkAlias, flatten, type Collection, type Include, type IncludedBundle, type Range } from "./boards";
import { analyzeFormulas, displayName, formulaProblems, isVariableName } from "./formulas";
import { parseVisualizations, type Visualization } from "./visualizations";

export type BoardDraft = {
  title: string;
  description: string;
  formulas: string[];
  // Starting values, keyed by variable name.
  values: Record<string, string>;
  // A short note on what each variable means, keyed by variable name.
  descriptions: Record<string, string>;
  // A unit label for each variable, such as % or m², keyed by variable name. Display only.
  units: Record<string, string>;
  // Variables the creator has hidden from the board, keyed by variable name. They still take part in
  // every calculation; they are just not shown to people using the board.
  hidden: Record<string, boolean>;
  // A friendlier name shown instead of the variable name, keyed by variable name. Display only.
  labels: Record<string, string>;
  // How many decimals to show for each variable's calculated value, keyed by variable name.
  // Display only: the maths always uses the full value. Variables without an entry show automatically.
  decimals: Record<string, number>;
  // The values a variable should stay within, keyed by variable name. Only used for warnings, sliders and
  // ranges in the spread chart; the maths does not stop at them.
  ranges: Record<string, Range>;
  // Lookup tables the formulas can call like functions, such as tax_rate(income).
  tables: Table[];
  // The order variables are listed in, by name. Variables not named come after, in the order they appear.
  order: string[];
  // Collections of items that people using the board can add boards to; their stats are added up.
  collections?: Collection[];
  // Short labels that make the board easier to find, such as finance or game.
  tags: string[];
  // Existing boards this one uses. Their variables are added under the alias, as alias.name.
  includes: Include[];
  // Variables linked to another variable, keyed by variable name: the two follow each other.
  links: Record<string, string>;
  // Drawings that follow the board's variables, such as a rectangle with its width and height.
  visualizations: Visualization[];
};

export type Board = BoardDraft & {
  id: string;
  createdAt: string;
  /** The user who owns it, or null for calculations made before there were users. */
  ownerId: string | null;
  ownerName: string | null;
};

/** What the browser gets: everything except the owner's id. */
export type PublicBoard = Omit<Board, "ownerId">;

export const LIMITS = {
  title: 120,
  description: 1000,
  formula: 500,
  formulas: 50,
  value: 50,
  variableDescription: 200,
  unit: 12,
  maxDecimals: 10,
  label: 40,
};

// The editor holds formulas as one block of text, one per line.
export function splitFormulas(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// `included` is the boards this one uses, already loaded by the server (see resolve-boards.ts). They
// are part of the system of formulas, so their variables can be named, noted and linked here too.
// What is saved of a used board: which board, its alias, the name shown for it and the version it is pinned to.
export const includeOf = (i: { board: string; alias: string; name?: string; version?: number; group?: string }): Include => ({
  board: i.board,
  alias: i.alias,
  ...(i.name ? { name: i.name } : {}),
  ...(i.version ? { version: i.version } : {}),
  ...(i.group ? { group: i.group } : {}),
});

export function validateDraft(
  raw: unknown,
  included: readonly IncludedBundle[] = [],
): { draft?: BoardDraft; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return { errors: ["Invalid data."] };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const formulas = (Array.isArray(r.formulas) ? r.formulas : []).map(str).filter(Boolean);
  const title = str(r.title);
  const description = str(r.description);

  if (!title) errors.push("Give the board a title.");
  if (title.length > LIMITS.title) errors.push(`Title must be at most ${LIMITS.title} characters.`);
  if (description.length > LIMITS.description)
    errors.push(`Description must be at most ${LIMITS.description} characters.`);
  if (formulas.length === 0) errors.push("Write at least one formula.");
  if (formulas.length > LIMITS.formulas) errors.push(`At most ${LIMITS.formulas} formulas.`);
  if (formulas.some((f) => f.length > LIMITS.formula))
    errors.push(`Each formula must be at most ${LIMITS.formula} characters.`);
  if (errors.length) return { errors };

  // What this board and the boards it uses make up together, before anything is overridden. Links
  // are left out here: they can only join variables that exist, so these are found first.
  const collections: Collection[] = [];
  for (const item of Array.isArray(r.collections) ? (r.collections as unknown[]).slice(0, 6) : []) {
    const c = item as { name?: unknown; stats?: unknown } | null;
    const name = typeof c?.name === "string" ? c.name.trim() : "";
    const problem = checkAlias(name);
    if (problem) errors.push(`The collection "${name}" can't be used: ${problem}.`);
    else if (collections.some((x) => x.name === name) || included.some((i) => i.alias === name)) errors.push(`The collection "${name}" has the same name as another collection or a used board.`);
    else {
      const stats = (Array.isArray(c?.stats) ? (c!.stats as unknown[]) : []).filter((x): x is string => typeof x === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(x.trim())).map((x) => x.trim());
      collections.push({ name, stats: [...new Set(stats)].slice(0, 20) });
    }
  }
  const parsedTables = parseTables(r.tables);
  errors.push(...parsedTables.errors);
  const tables = parsedTables.tables;
  const none = { values: {}, descriptions: {}, units: {}, labels: {}, hidden: {}, decimals: {}, ranges: {}, tables: [], order: [], links: {}, visualizations: [] };
  const { bundle: inherited, ownErrors } = flatten({ formulas, ...none, tables, collections }, included);
  for (const e of ownErrors) errors.push(`Line ${e.index + 1}: ${e.message}`);
  const analysis = analyzeFormulas(inherited.formulas, inherited.tables);
  for (const t of tables) {
    if (!isVariableName(t.name)) errors.push(`${t.name} is a built-in name, so it can't be a table.`);
    else if (analysis.variables.some((v) => v.name === t.name)) errors.push(`${t.name} is used both as a variable and as a table.`);
  }

  // A link joins two different variables that exist.
  const rawLinks = typeof r.links === "object" && r.links !== null ? (r.links as Record<string, unknown>) : {};
  const known = new Set(analysis.variables.map((v) => v.name));
  const links: Record<string, string> = {};
  for (const [from, to] of Object.entries(rawLinks)) {
    if (typeof to !== "string" || !known.has(from) || !known.has(to)) continue; // left over from a removed board
    if (from === to) errors.push(`${displayName(from)} can't be linked to itself.`);
    else links[from] = to;
  }

  // Problems with the formulas, the links and the used boards together. They are numbered formulas
  // first, then links, then the formulas of the used boards.
  const linkList = Object.entries(links);
  const flatSystem = flatten({ formulas, ...none, links, tables, collections }, included).bundle;
  const system = analyzeFormulas(flatSystem.formulas, flatSystem.tables);
  for (const problem of formulaProblems(system)) {
    const link = linkList[problem.line - formulas.length - 1];
    errors.push(
      problem.line <= formulas.length
        ? `Line ${problem.line}: ${problem.message}`
        : link
          ? `The link between ${displayName(link[0])} and ${displayName(link[1])}: ${problem.message}`
          : `A formula from a board that is used: ${problem.message}`,
    );
  }

  const rawValues = typeof r.values === "object" && r.values !== null ? (r.values as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const v = str(rawValues[variable.name]).slice(0, LIMITS.value);
    // A value that is just what the used board already says is not kept here, so that later
    // changes to that board still show through.
    if (v && !(variable.name in inherited.values && inherited.values[variable.name] === v)) values[variable.name] = v;
  }

  const rawDescriptions =
    typeof r.descriptions === "object" && r.descriptions !== null ? (r.descriptions as Record<string, unknown>) : {};
  const descriptions: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const d = str(rawDescriptions[variable.name]);
    if (d.length > LIMITS.variableDescription)
      errors.push(`The note on ${variable.name} must be at most ${LIMITS.variableDescription} characters.`);
    else if (d) descriptions[variable.name] = d;
  }

  const rawUnits = typeof r.units === "object" && r.units !== null ? (r.units as Record<string, unknown>) : {};
  const units: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const u = str(rawUnits[variable.name]);
    if (u.length > LIMITS.unit) errors.push(`The unit of ${variable.name} must be at most ${LIMITS.unit} characters.`);
    else if (u) units[variable.name] = u;
  }

  const rawLabels = typeof r.labels === "object" && r.labels !== null ? (r.labels as Record<string, unknown>) : {};
  const labels: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const l = str(rawLabels[variable.name]);
    if (l.length > LIMITS.label) errors.push(`The display name of ${variable.name} must be at most ${LIMITS.label} characters.`);
    else if (l) labels[variable.name] = l;
  }

  const rawHidden = typeof r.hidden === "object" && r.hidden !== null ? (r.hidden as Record<string, unknown>) : {};
  const hidden: Record<string, boolean> = {};
  for (const variable of analysis.variables) {
    // false is kept too: it shows a variable that a used board hides.
    if (typeof rawHidden[variable.name] === "boolean") hidden[variable.name] = rawHidden[variable.name] as boolean;
  }

  const rawDecimals =
    typeof r.decimals === "object" && r.decimals !== null ? (r.decimals as Record<string, unknown>) : {};
  const decimals: Record<string, number> = {};
  for (const variable of analysis.variables) {
    const d = rawDecimals[variable.name];
    if (d === undefined || d === null || d === "") continue;
    if (typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > LIMITS.maxDecimals) {
      errors.push(`Decimals for ${variable.name} must be a whole number from 0 to ${LIMITS.maxDecimals}.`);
    } else decimals[variable.name] = d;
  }

  const rawRanges = typeof r.ranges === "object" && r.ranges !== null ? (r.ranges as Record<string, unknown>) : {};
  const ranges: Record<string, Range> = {};
  for (const variable of analysis.variables) {
    const raw = rawRanges[variable.name];
    if (typeof raw !== "object" || raw === null) continue;
    const { min, max } = raw as Record<string, unknown>;
    const range: Range = {};
    for (const [key, v] of [["min", min], ["max", max]] as const) {
      if (v === undefined || v === null || v === "") continue;
      if (typeof v !== "number" || !Number.isFinite(v)) errors.push(`The ${key} of ${displayName(variable.name)} must be a number.`);
      else range[key] = v;
    }
    if (range.min !== undefined && range.max !== undefined && range.min > range.max)
      errors.push(`The min of ${displayName(variable.name)} can't be above its max.`);
    if (range.min !== undefined || range.max !== undefined) ranges[variable.name] = range;
  }

  const parsedViz = parseVisualizations(r.visualizations, known, true);
  errors.push(...parsedViz.errors);

  return errors.length
    ? { errors: [...new Set(errors)] }
    : {
        draft: {
          title,
          description,
          formulas,
          values,
          descriptions,
          units,
          hidden,
          labels,
          decimals,
          ranges,
          tables,
          collections,
          order: (Array.isArray(r.order) ? (r.order as unknown[]) : []).filter((n): n is string => typeof n === "string" && known.has(n)).filter((n, i, all) => all.indexOf(n) === i),
          tags: parseTags(r.tags),
          includes: included.map(includeOf),
          links,
          visualizations: parsedViz.visualizations,
        },
        errors,
      };
}
