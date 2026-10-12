"use client";

import { useState, type ReactNode } from "react";
import { sectionsByBoard } from "@/lib/boards";
import { displayName, type Analysis } from "@/lib/formulas";
import { checkVariableName } from "@/lib/rename";
import { VariableLine } from "./VariableLine";
import { ReorderList } from "./ui/ReorderList";
import { Chevron } from "./ui/Chevron";
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
  typedRows,
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
  /** Gives the new order of one list of variables (those shown together), by name. */
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
  /** The variables that are tables, collections and boards, shown after the others. */
  typedRows?: ReactNode;
  /** The rows of the boards that are used, by alias: each is shown at the top of the box with that board's variables. */
  boardRows?: Record<string, ReactNode>;
  /** How many of those there are (for the count in the title). */
  extraCount?: number;
  /** The "Add variable" button. */
  addVariable?: ReactNode;
}) {
  const fold = useFold();
  // Used boards that are folded away in this list.
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const sections = sectionsByBoard(analysis.variables, groups, order);

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

      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.key ?? "own"} className={`flex flex-col gap-4 ${section.key !== null ? "group-box" : ""}`}>
            {section.key && groups[section.key] && (
              <div className="flex cursor-pointer items-center justify-between gap-3" onClick={() => setClosed((c) => ({ ...c, [section.key!]: !c[section.key!] }))}>
                <h3 className="group-title">
                  {groups[section.key].title}{" "}
                  <span className="text-base text-ink-faint">
                    (used as {section.key}; its names can&apos;t be changed here, but everything else can)
                  </span>
                </h3>
                <button
                  type="button"
                  className="shrink-0 p-1 text-accent"
                  aria-expanded={!closed[section.key]}
                  aria-label={`${closed[section.key] ? "Expand" : "Collapse"} ${groups[section.key].title}`}
                  title={closed[section.key] ? "Expand" : "Collapse"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setClosed((c) => ({ ...c, [section.key!]: !c[section.key!] }));
                  }}
                >
                  <Chevron open={!closed[section.key]} />
                </button>
              </div>
            )}
            <div className={section.key && closed[section.key] ? "hidden" : "flex flex-col gap-4"}>
            {section.key && boardRows?.[section.key]}
            <ReorderList names={section.variables.map((v) => v.name)} onOrder={onOrder}>
              {(name, handle) => {
                const v = { name };
                return (
              <VariableLine
                name={name}
                handle={section.variables.length > 1 ? handle : undefined}
                expanded={fold.isOpen(v.name)}
                onToggle={() => fold.toggle(v.name)}
                fixedName={section.key ? displayName(v.name.slice(section.key.length + 1)) : undefined}
                unit={units[v.name] ?? ""}
                label={labels[v.name] ?? ""}
                hidden={hidden[v.name] === true}
                decimals={decimals[v.name] ?? ""}
                description={descriptions[v.name] ?? ""}
                validate={(next) => checkVariableName(next, v.name, analysis)}
                onRename={(next) => {
                  onRename(v.name, next);
                  // The line goes on under its new name; keep it unfolded.
                  if (fold.isOpen(v.name)) fold.open(next);
                }}
                onDescribe={(text) => onDescribe(v.name, text)}
                onUnit={(unit) => onUnit(v.name, unit)}
                onLabel={(text) => onLabel(v.name, text)}
                onHide={(value) => onHide(v.name, value)}
                onDecimals={(text) => onDecimals(v.name, text)}
                min={ranges[v.name]?.min ?? ""}
                max={ranges[v.name]?.max ?? ""}
                onRange={(end, text) => onRange(v.name, end, text)}
                type={types[v.name] ?? "number"}
                onType={(type) => onType(v.name, type)}
                choiceText={choiceTexts[v.name] ?? ""}
                onChoiceText={(text) => onChoiceText(v.name, text)}
                format={formats[v.name] ?? ""}
                onFormat={(format) => onFormat(v.name, format)}
              />
                );
              }}
            </ReorderList>
            </div>
          </div>
        ))}
        {Object.entries(boardRows ?? {})
          .filter(([alias]) => !sections.some((s) => s.key === alias))
          .map(([alias, row]) => (
            <div key={alias} className="group-box flex flex-col gap-4">
              {row}
            </div>
          ))}
        {typedRows && <div className="flex flex-col gap-3">{typedRows}</div>}
        {addVariable}
      </div>
    </CollapsibleSection>
  );
}
