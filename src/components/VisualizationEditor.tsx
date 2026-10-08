"use client";

import { useId, useState } from "react";
import { displayName, type Analysis } from "@/lib/formulas";
import { MAX_VISUALIZATIONS, VIZ_TYPES, vizType, type Visualization } from "@/lib/visualizations";

// The drawings of a board: pick a type, then say which variable gives each of its dimensions. Drawings
// of boards that are used come with those boards and are not edited here.
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
  // Folded away by default; the fields stay mounted while folded.
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  const choices = analysis.variables.map((v) => ({ name: v.name, text: labels[v.name] || displayName(v.name) }));
  const update = (index: number, next: Visualization) => onChange(visualizations.map((v, i) => (i === index ? next : v)));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">
          Drawings <span className="text-lg font-normal text-ink-muted">({visualizations.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="link text-base"
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      <div id={bodyId} className={open ? "flex flex-col gap-4" : "hidden"}>
        <p className="text-base text-ink-muted">
          A drawing follows the board&apos;s numbers as they change. Pick a shape and choose which variable is each of
          its dimensions. Any board can use any shape, and boards that use this one show its drawings with it.
        </p>

        {visualizations.map((viz, index) => {
          const type = vizType(viz.type);
          if (!type) return null;
          return (
            <div key={index} className="variable-box flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl">{type.label}</span>
                <button
                  type="button"
                  onClick={() => onChange(visualizations.filter((_, i) => i !== index))}
                  className="link text-base text-danger"
                  aria-label={`Remove the ${type.label.toLowerCase()} drawing`}
                >
                  Remove
                </button>
              </div>
              {type.params.map((param) => (
                <label key={param.key} className="flex flex-wrap items-baseline gap-x-3 text-lg">
                  <span className="w-full text-ink-muted sm:w-[45%]">{param.label}</span>
                  <select
                    className="field min-w-0 flex-1 bg-transparent text-lg"
                    value={viz.map[param.key] ?? ""}
                    onChange={(e) => {
                      const { [param.key]: _drop, ...rest } = viz.map;
                      void _drop;
                      update(index, { ...viz, map: e.target.value ? { ...rest, [param.key]: e.target.value } : rest });
                    }}
                    aria-label={`${type.label}: variable for ${param.label}`}
                  >
                    <option value="">Choose a variable</option>
                    {choices.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.text}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          );
        })}

        {visualizations.length < MAX_VISUALIZATIONS && (
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <span className="text-lg text-ink-muted">Add a drawing:</span>
            {VIZ_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => onChange([...visualizations, { type: type.id, map: {} }])}
                className="link text-lg"
              >
                + {type.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
