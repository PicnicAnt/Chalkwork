"use client";

import { displayName, type Analysis } from "@/lib/formulas";
import { MAX_VISUALIZATIONS, VIZ_TYPES, type Visualization } from "@/lib/visualizations";
import { VisualizationItem } from "./VisualizationItem";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { ExpandAllBar, useFold } from "./ui/Foldable";

// The drawings and charts of a board: pick a type, then say which variable plays each role. Those of
// boards that are used come with those boards and are not edited here.
export function VisualizationEditor({
  analysis,
  labels,
  visualizations,
  onChange,
}: {
  analysis: Analysis;
  /** Display names by variable name, to word the choices the way the board does. */
  labels: Record<string, string>;
  visualizations: Visualization[];
  onChange: (next: Visualization[]) => void;
}) {
  const fold = useFold();
  const choices = analysis.variables.map((v) => ({ name: v.name, text: labels[v.name] || displayName(v.name) }));
  const keys = visualizations.map((_, i) => String(i));

  return (
    <CollapsibleSection
      title="Drawings and charts"
      count={visualizations.length}
      description="Shapes follow the board's numbers as they change. Charts solve the board again with other values: a sweep shows how one variable moves another, sensitivity bars show which inputs matter most, and a breakdown shows how a total divides. Pick a type and choose which variable plays each role. Any board can use any type, and boards that use this one show its drawings with it."
    >
      {visualizations.length > 0 && <ExpandAllBar onExpandAll={() => fold.expandAll(keys)} onCollapseAll={fold.collapseAll} />}

      {visualizations.map((viz, index) => (
        <VisualizationItem
          key={index}
          viz={viz}
          choices={choices}
          expanded={fold.isOpen(String(index))}
          onToggle={() => fold.toggle(String(index))}
          onChange={(next) => onChange(visualizations.map((v, i) => (i === index ? next : v)))}
          onRemove={() => {
            // The rows after it move up, so what was unfolded would no longer match.
            fold.collapseAll();
            onChange(visualizations.filter((_, i) => i !== index));
          }}
        />
      ))}

      {visualizations.length < MAX_VISUALIZATIONS && (
        <div className="flex flex-col gap-2">
          {(["shape", "chart"] as const).map((kind) => (
            <div key={kind} className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className="text-lg text-ink-muted">{kind === "shape" ? "Add a shape:" : "Add a chart:"}</span>
              {VIZ_TYPES.filter((t) => t.kind === kind).map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    // The new one opens, ready to be set up.
                    fold.open(String(visualizations.length));
                    onChange([...visualizations, { type: type.id, map: {} }]);
                  }}
                  className="link text-lg"
                >
                  + {type.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
