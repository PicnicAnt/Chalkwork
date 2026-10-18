import { formatNumber } from "./formulas";
import { MAX_PRESETS, SCENARIO_LIMITS, type Preset } from "./scenarios";

// Presets from a pasted table: the first row names the variables (by their name or the label they have), the first column
// that is not a variable names the preset, and each row after it is a preset with those values. Plain logic.

export type TableImport = {
  presets: Preset[];
  /** Columns whose heading is not a variable of the board. */
  unmatched: string[];
  /** Rows left out, and why. */
  skipped: string[];
};

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

// Splits a line at the delimiter, keeping quoted cells together ("a, b" is one cell).
function cells(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      out.push(cell.trim());
      cell = "";
    } else cell += c;
  }
  out.push(cell.trim());
  return out;
}

// A spreadsheet pasted in is separated by tabs; a file by commas or semicolons (a semicolon file writes 1,5 for 1.5).
const delimiterOf = (head: string) => (head.includes("\t") ? "\t" : head.includes(";") ? ";" : ",");

function numberOf(text: string, delimiter: string): string | null {
  let t = text.trim().replace(/\s+/g, "");
  if (t.endsWith("%")) t = t.slice(0, -1);
  if (delimiter !== ",") t = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", ".");
  else t = t.replace(/,(?=\d{3}(\D|$))/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? formatNumber(n) : null;
}

/** `variables` are the names the board has, `labels` the names it shows for them. */
export function parseTable(text: string, variables: readonly string[], labels: Record<string, string>): TableImport {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const result: TableImport = { presets: [], unmatched: [], skipped: [] };
  if (lines.length < 2) {
    result.skipped.push("Paste a first row with the names of the variables and a row for each preset.");
    return result;
  }
  const delimiter = delimiterOf(lines[0]);
  const heads = cells(lines[0], delimiter);
  const byKey = new Map<string, string>();
  for (const v of variables) {
    for (const k of [v, labels[v], v.replace(/\$/g, " ").replace(/_/g, " ")]) if (k && !byKey.has(key(k))) byKey.set(key(k), v);
  }
  const columns = heads.map((h) => byKey.get(key(h)));
  const nameColumn = columns.findIndex((v) => v === undefined);
  heads.forEach((h, i) => {
    if (columns[i] === undefined && i !== nameColumn && h) result.unmatched.push(h);
  });
  if (nameColumn < 0) {
    result.skipped.push("Every column is a variable; one column needs the names of the presets.");
    return result;
  }
  for (const line of lines.slice(1)) {
    const row = cells(line, delimiter);
    const name = (row[nameColumn] ?? "").replace(/\s+/g, " ").trim();
    if (!name) {
      result.skipped.push("A row without a name.");
      continue;
    }
    if (name.length > SCENARIO_LIMITS.name) {
      result.skipped.push(`${name.slice(0, 20)}…: the name is too long.`);
      continue;
    }
    const values: Record<string, string> = {};
    columns.forEach((variable, i) => {
      if (!variable) return;
      const n = numberOf(row[i] ?? "", delimiter);
      if (n !== null) values[variable] = n;
    });
    if (Object.keys(values).length === 0) {
      result.skipped.push(`${name}: no numbers.`);
      continue;
    }
    if (result.presets.some((p) => p.name === name)) {
      result.skipped.push(`${name}: the name is used twice.`);
      continue;
    }
    result.presets.push({ name, values, locked: Object.keys(values) });
  }
  if (result.presets.length > MAX_PRESETS) {
    result.skipped.push(`Only the first ${MAX_PRESETS} presets are kept.`);
    result.presets = result.presets.slice(0, MAX_PRESETS);
  }
  return result;
}
