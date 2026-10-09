"use client";

import { sectionsByBoard } from "@/lib/boards";
import { displayName, type Analysis } from "@/lib/formulas";
import { checkVariableName } from "@/lib/rename";
import { VariableLine } from "./VariableLine";
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
  links,
  ownLinks,
  decimals,
  ranges,
  onRename,
  onDescribe,
  onUnit,
  onLabel,
  onHide,
  onLink,
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
  /** Every link, including those made by used boards, by variable name. */
  links: Record<string, string>;
  /** The links made on this board, which are the ones that can be changed here. */
  ownLinks: Record<string, string>;
  /** Decimals to show per variable, as typed (empty means automatic). */
  decimals: Record<string, string>;
  onRename: (from: string, to: string) => void;
  onDescribe: (name: string, text: string) => void;
  onUnit: (name: string, unit: string) => void;
  onLabel: (name: string, label: string) => void;
  onHide: (name: string, hidden: boolean) => void;
  /** Links a variable to another (by the other's internal name), or removes the link (null). */
  onLink: (name: string, target: string | null) => void;
  onDecimals: (name: string, decimals: string) => void;
  /** The values a variable should stay within, as typed. */
  ranges: Record<string, { min: string; max: string }>;
  onRange: (name: string, end: "min" | "max", text: string) => void;
}) {
  const fold = useFold();
  if (analysis.variables.length === 0) return null;

  const sections = sectionsByBoard(analysis.variables, groups);

  // The text typed in the link field is a person's way of writing a variable (board.variable).
  function applyLink(name: string, text: string): string | null {
    const target = text.replaceAll(".", "$");
    if (!target) {
      onLink(name, null);
      return null;
    }
    if (!analysis.variables.some((other) => other.name === target)) return `No variable called ${text}`;
    if (target === name) return "A variable can't be linked to itself";
    onLink(name, target);
    return null;
  }

  return (
    <CollapsibleSection
      title="Variables"
      count={analysis.variables.length}
      description={
        <>
          Rename a variable and every formula that uses it is updated. A display name is shown instead of it on the
          rows (the formulas still use the real name). Hide a variable to keep it off the board while it still takes
          part in the maths. A unit (like % or m²) is shown next to the value, decimals set how many digits a
          calculated value shows, and a note is shown under the variable. Units and decimals only change what is
          displayed, never the maths.
        </>
      }
    >
      <datalist id="link-targets">
        {analysis.variables.map((v) => (
          <option key={v.name} value={displayName(v.name)} />
        ))}
      </datalist>
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
          <div key={section.key ?? "own"} className={`flex flex-col gap-4 ${sections.length > 1 ? "group-box" : ""}`}>
            {section.key && groups[section.key] && (
              <h3 className="group-title">
                {groups[section.key].title}{" "}
                <span className="text-base text-ink-faint">
                  (used as {section.key}; its names can&apos;t be changed here, but everything else can)
                </span>
              </h3>
            )}
            {section.variables.map((v) => (
              <VariableLine
                key={v.name}
                name={v.name}
                expanded={fold.isOpen(v.name)}
                onToggle={() => fold.toggle(v.name)}
                fixedName={section.key ? displayName(v.name.slice(section.key.length + 1)) : undefined}
                unit={units[v.name] ?? ""}
                label={labels[v.name] ?? ""}
                hidden={hidden[v.name] === true}
                linkedTo={links[v.name] ? displayName(links[v.name]) : ""}
                linkLocked={v.name in links && !(v.name in ownLinks)}
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
                onLink={(text) => applyLink(v.name, text)}
                onDecimals={(text) => onDecimals(v.name, text)}
                min={ranges[v.name]?.min ?? ""}
                max={ranges[v.name]?.max ?? ""}
                onRange={(end, text) => onRange(v.name, end, text)}
              />
            ))}
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}
