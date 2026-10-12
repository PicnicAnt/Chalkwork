"use client";

import { useEffect, useRef, useState } from "react";
import { VIZ_TYPES } from "@/lib/visualizations";
import { VizPreview } from "./VizPreview";

// One line on what each kind shows, next to its picture.
const BLURBS: Record<string, string> = {
  circle: "A circle from its radius, with the radius marked.",
  ellipse: "An oval from its two radii.",
  rectangle: "A rectangle drawn to its width and height.",
  triangle: "A triangle from its base and height.",
  polygon: "A regular shape with equal sides, from the length of a side and how many sides.",
  donut: "A donut: a ring of dough, from the ring radius and the dough radius.",
  annulus: "A flat ring (washer) from its outer radius and the radius of the hole.",
  sphere: "A ball from its radius.",
  cylinder: "A can from its radius and height.",
  cone: "A cone from its radius and height.",
  pyramid: "A pyramid from the width and depth of its base, and its height.",
  box: "A box from its width, height and depth.",
  sweep: "A line: how one variable changes a result as it moves across a range.",
  spread: "How the result spreads when the inputs between their lowest and highest values vary.",
  sensitivity: "Bars showing which inputs move the result the most.",
  breakdown: "A bar showing how a total divides into parts and what is left.",
  contributions: "What each board in a collection adds to a total.",
  gauge: "A dial showing where a value sits between a lowest and a highest.",
  bars: "Bars comparing the variables you choose side by side.",
  pie: "A pie of how the parts share a whole.",
  heatmap: "A grid of colours: how a result changes as two variables vary.",
  dependency: "A diagram of which variables a result is worked out from.",
};

// "Add shape" and "Add chart": each is a button that opens a list of the kinds, with a picture and a line about each.
export function AddVisualization({ kind, onAdd }: { kind: "shape" | "chart"; onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" className="btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {kind === "shape" ? "Add shape" : "Add chart"} ▾
      </button>
      {open && (
        <ul className="sketch-box absolute left-0 z-30 mt-1 flex max-h-[70vh] w-[min(26rem,86vw)] flex-col overflow-y-auto bg-[var(--board)] p-1 shadow-lg">
          {VIZ_TYPES.filter((t) => t.kind === kind).map((type) => (
            <li key={type.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-[var(--board-edge)]"
                onClick={() => {
                  setOpen(false);
                  onAdd(type.id);
                }}
              >
                <VizPreview type={type.id} className="h-10 w-14 shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-lg leading-tight">{type.label}</span>
                  <span className="text-sm leading-snug text-ink-muted">{BLURBS[type.id] ?? ""}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
