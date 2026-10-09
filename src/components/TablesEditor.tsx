"use client";

import { parseTableRows, TABLE_LIMITS, type Table, type TableMode } from "@/lib/tables";
import { CollapsibleSection } from "./ui/CollapsibleSection";

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

// Lookup tables a formula can call like a function: tax_rate(income) looks income up in the table named tax_rate.
export function TablesEditor({
  drafts,
  problems,
  onChange,
}: {
  drafts: TableDraft[];
  problems: (string | null)[];
  onChange: (drafts: TableDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<TableDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <CollapsibleSection
      title="Tables"
      count={drafts.length}
      description="A table is a list of x and y values that a formula can call like a function: with a table named tax_rate, write tax_rate(income) in a formula. A step table gives the y of the last row at or below the value (brackets, tiers, price lists). A linear table draws straight lines between the rows (a curve read off a chart). Outside the rows the first or last y is used. Write one row per line as x, y."
    >
      <div className="flex flex-col gap-5">
        {drafts.map((d, i) => (
          <div key={i} className="flex flex-col gap-2">
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
            <textarea
              className="field min-h-[7rem] w-full text-lg"
              value={d.text}
              placeholder={"0, 10\n20000, 20\n50000, 30"}
              onChange={(e) => update(i, { text: e.target.value })}
              spellCheck={false}
              aria-label={`Rows of table ${d.name || i + 1}`}
            />
            {problems[i] && <p className="text-base text-danger">{problems[i]}</p>}
          </div>
        ))}
        {drafts.length < TABLE_LIMITS.tables && (
          <div>
            <button type="button" className="btn" onClick={() => onChange([...drafts, { name: "", mode: "step", text: "" }])}>
              Add a table
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
