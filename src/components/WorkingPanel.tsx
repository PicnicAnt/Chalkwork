"use client";

import { localizeNumbers } from "@/lib/locale";
import { workingName, type Working } from "@/lib/working";
import { useNumberLocale } from "./useNumberLocale";

// How a value was worked out, as a small tree: the equation with the numbers put in, and under it how each of those
// numbers came about. Shown under the variable it explains.
export function WorkingPanel({ working, labels, unitOf, onClose }: { working: Working; labels?: Record<string, string>; unitOf: (name: string) => string; onClose: () => void }) {
  return (
    <div className="sketch-box mt-1 flex flex-col gap-1 px-3 py-2 text-base" role="region" aria-label={`How ${workingName(working.name, labels)} was worked out`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ink-muted">How this was worked out</span>
        <button type="button" className="link text-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <Node node={working} labels={labels} unitOf={unitOf} top />
    </div>
  );
}

function Node({ node, labels, unitOf, top = false }: { node: Working; labels?: Record<string, string>; unitOf: (name: string) => string; top?: boolean }) {
  const loc = useNumberLocale();
  const unit = unitOf(node.name);
  const value = node.value ? `${localizeNumbers(node.value, loc)}${unit ? ` ${unit}` : ""}` : "no value yet";
  return (
    <div className={top ? "" : "border-l-2 border-[var(--ink-faint)] pl-3"}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg">{workingName(node.name, labels)}</span>
        <span className="text-ink-muted">=</span>
        <span className="text-lg text-accent">{value}</span>
        {node.how === "set" && <span className="text-sm text-ink-faint">typed or kept as it is</span>}
        {node.how === "none" && node.note && <span className="text-sm text-ink-faint">{node.note}</span>}
      </div>
      {node.formula && (
        <p className="text-ink-muted">
          <span className="text-accent-2">{node.formula}</span>
          {node.numbers && node.numbers !== node.formula && (
            <>
              {" "}
              → <span className="text-ink">{node.numbers}</span>
            </>
          )}
        </p>
      )}
      {node.note && node.how !== "none" && <p className="text-sm text-ink-faint">{node.note}</p>}
      {node.inputs.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {node.inputs.map((input) => (
            <Node key={input.name} node={input} labels={labels} unitOf={unitOf} />
          ))}
        </div>
      )}
    </div>
  );
}
