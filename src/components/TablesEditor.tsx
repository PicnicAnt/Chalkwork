"use client";

import { parseTableRows, TABLE_LIMITS, type Table, type TableMode } from "@/lib/tables";
import { Foldable } from "./ui/Foldable";

/** A table as it is typed: the rows are text until they are read. */
export type TableDraft = { name: string; mode: TableMode; text: string };

// What the editor turns the typed tables into: the ones that can be used, and what is wrong with the others.
export function readTableDrafts(drafts: readonly TableDraft[]): { tables: Table[]; problems: (string | null)[] } {
  const problems = drafts.map((d, i) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(d.name)) return "The name needs letters, digits and underscores, starting with a letter.";
    if (drafts.some((o, j) => j < i && o.name === d.name)) return "Another table has this name.";
    const { rows, problem } = parseTableRows(d.text);
    if (problem) return problem;
    if (rows.length === 0) return "Add at least one row.";
    if (rows.some((r, k) => k > 0 && r[0] === rows[k - 1][0])) return "Two rows have the same x.";
    return null;
  });
  const tables = drafts.flatMap((d, i) => (problems[i] === null ? [{ name: d.name, mode: d.mode, rows: parseTableRows(d.text).rows }] : []));
  return { tables, problems };
}

// The variables of the type table: a list of x and y values that a formula calls like a function, so with a table
// named tax_rate, tax_rate(income) looks income up in it. Shown as rows of the variable list.
export function tableItems({
  drafts,
  problems,
  onChange,
  isOpen,
  onToggle,
}: {
  drafts: TableDraft[];
  problems: (string | null)[];
  onChange: (drafts: TableDraft[]) => void;
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
}) {
  const update = (i: number, patch: Partial<TableDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return drafts.map((d, i) => ({
    id: d.name.trim() || `new:table:${i}`,
    render: (handle?: React.ReactNode) => (
        <Foldable
          key={i}
          handle={handle}
          expanded={isOpen(`table:${i}`)}
          onToggle={() => onToggle(`table:${i}`)}
          summary={d.name || "New table"}
          hint={` · table, ${d.mode === "step" ? "step" : "linear"}${problems[i] ? " · needs attention" : ""}`}
        >
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <input
              className="field w-48 text-xl"
              value={d.name}
              maxLength={TABLE_LIMITS.name}
              placeholder="table_name"
              onChange={(e) => update(i, { name: e.target.value })}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={`Name of table ${i + 1}`}
            />
            <select value={d.mode} onChange={(e) => update(i, { mode: e.target.value as TableMode })} className="cursor-pointer bg-transparent text-lg" aria-label={`How table ${d.name || i + 1} reads between rows`}>
              <option value="step">step (last row at or below)</option>
              <option value="linear">linear (straight lines between rows)</option>
            </select>
            <button type="button" className="link text-base text-danger" onClick={() => onChange(drafts.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
          <p className="text-base text-ink-muted">One row per line as x, y. Used in a formula like {d.name || "table_name"}(x). Outside the rows the first or last y is used.</p>
          <textarea
            className="field min-h-[7rem] w-full text-lg"
            value={d.text}
            placeholder={"0, 10\n20000, 20\n50000, 30"}
            onChange={(e) => update(i, { text: e.target.value })}
            spellCheck={false}
            aria-label={`Rows of table ${d.name || i + 1}`}
          />
          {problems[i] && <p className="text-base text-danger">{problems[i]}</p>}
        </Foldable>
    ),
  }));
}
