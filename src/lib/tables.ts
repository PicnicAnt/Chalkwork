// Lookup tables: a table of x and y values that a formula can call like a function, such as tax_rate(income). A
// "step" table gives the y of the last row whose x is not above the value (brackets, tiers, price lists); a "linear"
// table draws a straight line between the rows (curves read off a chart). Outside the rows the first or last y is
// used. Plain logic, so it is the same on the server and in the browser.

export type TableMode = "step" | "linear";
export type Table = { name: string; mode: TableMode; rows: [number, number][] };

export const TABLE_LIMITS = { tables: 10, rows: 200, name: 30 };

export function lookup(table: Table, x: number): number {
  const rows = table.rows;
  if (rows.length === 0 || !Number.isFinite(x)) return NaN;
  if (x <= rows[0][0]) return rows[0][1];
  const last = rows[rows.length - 1];
  if (x >= last[0]) return last[1];
  // The last row at or below x; rows are in ascending order.
  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  if (table.mode === "step") return rows[lo][1];
  const [x0, y0] = rows[lo];
  const [x1, y1] = rows[hi];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/** The tables as functions a formula can call, by name. */
export const tableFunctions = (tables: readonly Table[]): Record<string, (x: number) => number> =>
  Object.fromEntries(tables.map((t) => [t.name, (x: number) => lookup(t, Number(x))]));

// Rows written as lines of "x y" (or "x, y", or "x; y", or a tab). Lines that aren't two numbers are reported.
export function parseTableRows(text: string): { rows: [number, number][]; problem?: string } {
  const rows: [number, number][] = [];
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[\s,;]+/).filter(Boolean);
    const [x, y] = parts.map((p) => Number(p));
    if (parts.length !== 2 || !Number.isFinite(x) || !Number.isFinite(y)) return { rows, problem: `Line ${i + 1} ("${line.slice(0, 30)}") should be two numbers: x and y.` };
    rows.push([x, y]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  return { rows };
}

export const rowsToText = (rows: readonly (readonly [number, number])[]) => rows.map(([x, y]) => `${x}, ${y}`).join("\n");

// Why a table can't be used, or null.
export function tableProblem(table: Table): string | null {
  const name = table.name;
  if (table.rows.length < 1) return `Table ${name} needs at least one row.`;
  if (table.rows.length > TABLE_LIMITS.rows) return `Table ${name} can have at most ${TABLE_LIMITS.rows} rows.`;
  for (let i = 1; i < table.rows.length; i++) if (table.rows[i][0] === table.rows[i - 1][0]) return `Table ${name} has two rows for ${table.rows[i][0]}.`;
  return null;
}

/** Reads a table that was sent, or says why it can't be used. */
export function parseTables(raw: unknown): { tables: Table[]; errors: string[] } {
  const errors: string[] = [];
  const tables: Table[] = [];
  if (raw === undefined || raw === null) return { tables, errors };
  if (!Array.isArray(raw)) return { tables, errors: ["The tables couldn't be read."] };
  if (raw.length > TABLE_LIMITS.tables) errors.push(`At most ${TABLE_LIMITS.tables} tables.`);
  for (const item of raw.slice(0, TABLE_LIMITS.tables)) {
    const t = item as { name?: unknown; mode?: unknown; rows?: unknown };
    const name = typeof t?.name === "string" ? t.name.trim() : "";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || name.length > TABLE_LIMITS.name) {
      errors.push(`"${name}" can't be a table name: use letters, digits and underscores, starting with a letter.`);
      continue;
    }
    if (tables.some((x) => x.name === name)) {
      errors.push(`Two tables are called ${name}.`);
      continue;
    }
    const mode: TableMode = t.mode === "linear" ? "linear" : "step";
    const rows: [number, number][] = [];
    let bad = false;
    for (const r of Array.isArray(t.rows) ? t.rows : []) {
      if (!Array.isArray(r) || r.length !== 2 || typeof r[0] !== "number" || typeof r[1] !== "number" || !Number.isFinite(r[0]) || !Number.isFinite(r[1])) bad = true;
      else rows.push([r[0], r[1]]);
    }
    if (bad) errors.push(`Table ${name} has a row that isn't two numbers.`);
    rows.sort((a, b) => a[0] - b[0]);
    const table = { name, mode, rows };
    const problem = tableProblem(table);
    if (problem) errors.push(problem);
    tables.push(table);
  }
  return { tables, errors };
}
