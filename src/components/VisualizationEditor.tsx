"use client";

import { displayName, type Analysis } from "@/lib/formulas";
import { MAX_VISUALIZATIONS, VIZ_TYPES, type Visualization } from "@/lib/visualizations";
import { VisualizationItem } from "./VisualizationItem";
import { AddVisualization } from "./AddVisualization";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { ReorderList } from "./ui/ReorderList";
import { useFold } from "./ui/Foldable";

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
      <ReorderList
        names={keys}
        gap="gap-2"
        labelOf={(k) => VIZ_TYPES.find((t) => t.id === visualizations[Number(k)]?.type)?.label ?? "drawing"}
        onOrder={(order) => {
          // Rows keep being unfolded after they move: the open ones are found again at their new place.
          const open = keys.filter((k) => fold.isOpen(k)).map((k) => String(order.indexOf(k)));
          onChange(order.map((k) => visualizations[Number(k)]));
          fold.expandAll(open);
        }}
      >
        {(key, handle) => {
          const index = Number(key);
          const viz = visualizations[index];
          return (
        <VisualizationItem
          key={index}
          handle={visualizations.length > 1 ? handle : undefined}
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
          );
        }}
      </ReorderList>

      {visualizations.length < MAX_VISUALIZATIONS && (
        <div className="flex flex-wrap items-start gap-3">
          {(["shape", "chart"] as const).map((kind) => (
            <AddVisualization
              key={kind}
              kind={kind}
              onAdd={(type) => {
                // The new one opens, ready to be set up.
                fold.open(String(visualizations.length));
                onChange([...visualizations, { type, map: {} }]);
              }}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
