"use client";

import { useId, useState } from "react";
import { displayName, type Analysis } from "@/lib/formulas";
import { MAX_VISUALIZATIONS, VIZ_TYPES, vizType, type Visualization } from "@/lib/visualizations";

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
  // Folded away by default; the fields stay mounted while folded.
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  const choices = analysis.variables.map((v) => ({ name: v.name, text: labels[v.name] || displayName(v.name) }));
  const textOf = (name: string) => choices.find((c) => c.name === name)?.text ?? displayName(name);
  const update = (index: number, next: Visualization) => onChange(visualizations.map((v, i) => (i === index ? next : v)));

  const without = <T,>(record: Record<string, T> | undefined, key: string) => {
    const { [key]: _drop, ...rest } = record ?? {};
    void _drop;
    return rest;
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">
          Drawings and charts <span className="text-lg font-normal text-ink-muted">({visualizations.length})</span>
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
          Shapes follow the board&apos;s numbers as they change. Charts solve the board again with other values: a
          sweep shows how one variable moves another, sensitivity bars show which inputs matter most, and a breakdown
          shows how a total divides. Pick a type and choose which variable plays each role. Any board can use any type,
          and boards that use this one show its drawings with it.
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
                  aria-label={`Remove the ${type.label.toLowerCase()}`}
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
                    onChange={(e) =>
                      update(index, {
                        ...viz,
                        map: e.target.value ? { ...viz.map, [param.key]: e.target.value } : without(viz.map, param.key),
                      })
                    }
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

              {(type.lists ?? []).map((slot) => {
                const chosen = viz.lists?.[slot.key] ?? [];
                return (
                  <div key={slot.key} className="flex flex-col gap-1">
                    <span className="text-lg text-ink-muted">{slot.label}</span>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {chosen.map((name) => (
                        <span key={name} className="flex items-baseline gap-1 text-lg">
                          {textOf(name)}
                          <button
                            type="button"
                            className="link text-base text-danger"
                            onClick={() => {
                              const next = chosen.filter((n) => n !== name);
                              update(index, { ...viz, lists: next.length ? { ...viz.lists, [slot.key]: next } : without(viz.lists, slot.key) });
                            }}
                            aria-label={`Take ${textOf(name)} out`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <select
                        className="field w-auto min-w-[10rem] bg-transparent text-lg"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value || chosen.includes(e.target.value)) return;
                          update(index, { ...viz, lists: { ...viz.lists, [slot.key]: [...chosen, e.target.value] } });
                        }}
                        aria-label={`${type.label}: add a variable to ${slot.label}`}
                      >
                        <option value="">+ Add a variable</option>
                        {choices
                          .filter((c) => !chosen.includes(c.name))
                          .map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.text}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                );
              })}

              {(type.options ?? []).map((slot) => (
                <label key={slot.key} className="flex flex-wrap items-baseline gap-x-3 text-lg">
                  <span className="w-full text-ink-muted sm:w-[45%]">{slot.label}</span>
                  <input
                    className="field w-40 text-lg"
                    inputMode="decimal"
                    placeholder={slot.placeholder}
                    value={viz.options?.[slot.key] ?? ""}
                    onChange={(e) => {
                      const text = e.target.value.trim();
                      const n = Number(text);
                      update(index, {
                        ...viz,
                        options: text !== "" && Number.isFinite(n) ? { ...viz.options, [slot.key]: n } : without(viz.options, slot.key),
                      });
                    }}
                    aria-label={`${type.label}: ${slot.label}`}
                  />
                </label>
              ))}
            </div>
          );
        })}

        {visualizations.length < MAX_VISUALIZATIONS && (
          <div className="flex flex-col gap-2">
            {(["shape", "chart"] as const).map((kind) => (
              <div key={kind} className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <span className="text-lg text-ink-muted">{kind === "shape" ? "Add a shape:" : "Add a chart:"}</span>
                {VIZ_TYPES.filter((t) => t.kind === kind).map((type) => (
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
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
