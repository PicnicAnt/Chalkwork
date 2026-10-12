"use client";

import type { ReactNode } from "react";
import { sectionsByBoard } from "@/lib/boards";
import { displayName, type Analysis } from "@/lib/formulas";
import { checkVariableName } from "@/lib/rename";
import { VariableLine } from "./VariableLine";
import { ReorderList } from "./ui/ReorderList";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { ExpandAllBar, useFold } from "./ui/Foldable";

// Units people commonly want, offered as suggestions while typing a unit.
const COMMON_UNITS = ["%", "m", "m²", "m³", "cm", "cm²", "cm³", "mm", "km", "km²", "in", "ft", "mi", "kg", "g", "mg", "lb", "s", "ms", "min", "h", "d", "km/h", "m/s", "/s", "°C", "$", "€", "£", "USD", "W", "kW", "kWh", "L", "mL", "px"];

// One folded line per variable: its name, which can be changed (the formulas are rewritten to match), a
// unit such as % or m², a note about what it means, and more. People see the unit and the note on the
// shared page. Variables of used boards are listed under that board.
export function VariableEditor({
  analysis,
  groups,
  descriptions,
  units,
  labels,
  hidden,
  decimals,
  ranges,
  order,
  onOrder,
  types,
  onType,
  formats,
  onFormat,
  choiceTexts,
  onChoiceText,
  typedItems,
  notice,
  boardRows,
  extraCount = 0,
  addVariable,
  onRename,
  onDescribe,
  onUnit,
  onLabel,
  onHide,
  onDecimals,
  onRange,
}: {
  analysis: Analysis;
  /** The boards in use, by alias. Their variables are listed under their title. */
  groups: Record<string, { title: string; board: string }>;
  descriptions: Record<string, string>;
  units: Record<string, string>;
  labels: Record<string, string>;
  /** Variables hidden from the board. */
  hidden: Record<string, boolean>;
  /** Decimals to show per variable, as typed (empty means automatic). */
  decimals: Record<string, string>;
  onRename: (from: string, to: string) => void;
  onDescribe: (name: string, text: string) => void;
  onUnit: (name: string, unit: string) => void;
  onLabel: (name: string, label: string) => void;
  onHide: (name: string, hidden: boolean) => void;
  onDecimals: (name: string, decimals: string) => void;
  /** The values a variable should stay within, as typed. */
  ranges: Record<string, { min: string; max: string }>;
  onRange: (name: string, end: "min" | "max", text: string) => void;
  /** The order variables are listed in. */
  order: string[];
  /** Gives the new order of one list of rows (those shown together), by name. */
  onOrder: (names: string[]) => void;
  /** What each variable holds (a variable with no entry is a number). */
  types: Record<string, "number" | "boolean" | "choice">;
  onType: (name: string, type: "number" | "boolean" | "choice") => void;
  /** The options of each choice variable, as typed. */
  choiceTexts: Record<string, string>;
  onChoiceText: (name: string, text: string) => void;
  /** How each number is written (no entry: as it comes). */
  formats: Record<string, "grouped" | "percent" | "currency">;
  onFormat: (name: string, format: "" | "grouped" | "percent" | "currency") => void;
  /** The tables and collections, each a row that can be put anywhere in the list. */
  typedItems?: { id: string; render: (handle?: ReactNode) => ReactNode }[];
  /** Something to say above the list (why a board couldn't be added). */
  notice?: ReactNode;
  /** The rows of the boards that are used, by alias: each is shown at the top of the box with that board's variables. */
  boardRows?: Record<string, (children: ReactNode, handle?: ReactNode) => ReactNode>;
  /** How many of those there are (for the count in the title). */
  extraCount?: number;
  /** The "Add variable" button. */
  addVariable?: ReactNode;
}) {
  const fold = useFold();
  const sections = sectionsByBoard(analysis.variables, groups, order);

  // One line for a variable.
  const line = (name: string, key: string | null, handle?: ReactNode) => (
    <VariableLine
      key={name}
      name={name}
      handle={handle}
      expanded={fold.isOpen(name)}
      onToggle={() => fold.toggle(name)}
      fixedName={key ? displayName(name.slice(key.length + 1)) : undefined}
      unit={units[name] ?? ""}
      label={labels[name] ?? ""}
      hidden={hidden[name] === true}
      decimals={decimals[name] ?? ""}
      description={descriptions[name] ?? ""}
      validate={(next) => checkVariableName(next, name, analysis)}
      onRename={(next) => {
        onRename(name, next);
        // The line goes on under its new name; keep it unfolded.
        if (fold.isOpen(name)) fold.open(next);
      }}
      onDescribe={(text) => onDescribe(name, text)}
      onUnit={(unit) => onUnit(name, unit)}
      onLabel={(text) => onLabel(name, text)}
      onHide={(value) => onHide(name, value)}
      onDecimals={(text) => onDecimals(name, text)}
      min={ranges[name]?.min ?? ""}
      max={ranges[name]?.max ?? ""}
      onRange={(end, text) => onRange(name, end, text)}
      type={types[name] ?? "number"}
      onType={(type) => onType(name, type)}
      choiceText={choiceTexts[name] ?? ""}
      onChoiceText={(text) => onChoiceText(name, text)}
      format={formats[name] ?? ""}
      onFormat={(format) => onFormat(name, format)}
    />
  );
  // The variables of one used board, which can be put in order among themselves.
  const lines = (section: (typeof sections)[number]) => (
    <ReorderList names={section.variables.map((v) => v.name)} onOrder={onOrder} gap="gap-2">
      {(name, handle) => line(name, section.key, section.variables.length > 1 ? handle : undefined)}
    </ReorderList>
  );

  // Everything in the list is a row that can be dragged: the board's own variables, each used board (with its
  // variables inside), the tables and the collections.
  const items: Record<string, (handle?: ReactNode) => ReactNode> = {};
  const defaults: string[] = [];
  for (const section of sections) {
    if (section.key === null) {
      for (const v of section.variables) {
        items[v.name] = (handle) => line(v.name, null, handle);
        defaults.push(v.name);
      }
      continue;
    }
    const key = section.key;
    // A collection's totals are the collection's own row, not a board's variables.
    if (groups[key]?.board === "") continue;
    const wrap = boardRows?.[key];
    items[key] = (handle) =>
      wrap ? (
        wrap(
          <div className="flex flex-col gap-2">
            <p className="text-base text-ink-muted">Its variable names can&apos;t be changed here, but everything else can.</p>
            {lines(section)}
          </div>,
          handle,
        )
      ) : (
        // A collection's totals: not a board, so a plain titled box.
        <div className="group-box flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="group-title">{groups[key]?.title ?? key}</h3>
          </div>
          {lines(section)}
        </div>
      );
    defaults.push(key);
  }
  for (const [alias, row] of Object.entries(boardRows ?? {})) {
    if (items[alias]) continue;
    items[alias] = (handle) => row(null, handle);
    defaults.push(alias);
  }
  for (const t of typedItems ?? []) {
    items[t.id] = t.render;
    defaults.push(t.id);
  }
  // Rows named in the saved order come first, in that order; the rest keep the order they come in.
  const place = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ids = defaults.map((id, i) => ({ id, i })).sort((a, b) => place(a.id) - place(b.id) || a.i - b.i).map((x) => x.id);

  return (
    <CollapsibleSection
      title="Variables"
      count={analysis.variables.length + extraCount}
      description={
        <>
          A variable is a number, a yes/no, a table, a collection or a board; &ldquo;Add variable&rdquo; at the end adds one of any type. A table is looked up like a function (tax_rate(income)), a collection totals the boards people add to it (parts.weight), and a board brings another board&apos;s variables in as name.variable. Rename a number and every formula that uses it is updated. A display name is shown instead of it on the
          rows (the formulas still use the real name). Hide a variable to keep it off the board while it still takes
          part in the maths. A unit (like % or m²) is shown next to the value, decimals set how many digits a
          calculated value shows, and a note is shown under the variable. Units and decimals only change what is
          displayed, never the maths.
        </>
      }
    >
      <datalist id="unit-suggestions">
        {COMMON_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <ExpandAllBar
        onExpandAll={() => fold.expandAll(analysis.variables.map((v) => v.name))}
        onCollapseAll={fold.collapseAll}
      />

      {notice}
      <div className="flex flex-col gap-3">
        <ReorderList names={ids} onOrder={onOrder} gap="gap-2">
          {(id, handle) => items[id]?.(handle)}
        </ReorderList>
        {addVariable}
      </div>
    </CollapsibleSection>
  );
}
