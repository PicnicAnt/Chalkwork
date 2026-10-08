"use client";

import { vizType, type Visualization } from "@/lib/visualizations";
import { Foldable } from "./ui/Foldable";

export type VariableChoice = { name: string; text: string };

const without = <T,>(record: Record<string, T> | undefined, key: string): Record<string, T> => {
  const { [key]: dropped, ...rest } = record ?? {};
  void dropped;
  return rest;
};

// One drawing or chart in the editor: which variable plays each role of its type, which variables make up
// each list, and the numbers it takes as options.
export function VisualizationItem({
  viz,
  choices,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  viz: Visualization;
  choices: VariableChoice[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: Visualization) => void;
  onRemove: () => void;
}) {
  const type = vizType(viz.type);
  if (!type) return null;
  const textOf = (name: string) => choices.find((c) => c.name === name)?.text ?? name;
  const mapped = type.params.map((p) => viz.map[p.key]).filter(Boolean).map(textOf);

  return (
    <Foldable expanded={expanded} onToggle={onToggle} summary={type.label} hint={mapped.length ? ` · ${mapped.join(", ")}` : " · not set up yet"}>
      {type.params.map((param) => (
        <label key={param.key} className="flex flex-wrap items-baseline gap-x-3 text-lg">
          <span className="w-full text-ink-muted sm:w-[45%]">{param.label}</span>
          <select
            className="field min-w-0 flex-1 bg-transparent text-lg"
            value={viz.map[param.key] ?? ""}
            onChange={(e) =>
              onChange({
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
        const setList = (next: string[]) =>
          onChange({ ...viz, lists: next.length ? { ...viz.lists, [slot.key]: next } : without(viz.lists, slot.key) });
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
                    onClick={() => setList(chosen.filter((n) => n !== name))}
                    aria-label={`Take ${textOf(name)} out`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                className="field w-auto min-w-[10rem] bg-transparent text-lg"
                value=""
                onChange={(e) => e.target.value && !chosen.includes(e.target.value) && setList([...chosen, e.target.value])}
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
              onChange({
                ...viz,
                options: text !== "" && Number.isFinite(n) ? { ...viz.options, [slot.key]: n } : without(viz.options, slot.key),
              });
            }}
            aria-label={`${type.label}: ${slot.label}`}
          />
        </label>
      ))}

      <div>
        <button type="button" onClick={onRemove} className="link text-base text-danger" aria-label={`Remove the ${type.label.toLowerCase()}`}>
          Remove
        </button>
      </div>
    </Foldable>
  );
}
