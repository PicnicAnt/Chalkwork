"use client";

import { useRef, useState, type ReactNode } from "react";

// A list whose rows are put in order by dragging a handle at their left, with a finger, a pen or a mouse. Each row
// is given its handle to place. The new order is handed over when the handle is let go.
export function ReorderList({
  names,
  onOrder,
  children,
  gap = "gap-4",
}: {
  names: string[];
  /** The names in their new order. */
  onOrder: (names: string[]) => void;
  /** One row; `handle` is the grip to draw at its left. */
  children: (name: string, handle: ReactNode) => ReactNode;
  /** The space between rows, as a class. */
  gap?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ name: string; before: number } | null>(null);

  // The place the dragged row would go, as the number of other rows that stay above it.
  function slotAt(name: string, y: number): number {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>(":scope > [data-reorder]") ?? [])].filter((r) => r.dataset.reorder !== name);
    let slot = 0;
    for (const row of rows) {
      const box = row.getBoundingClientRect();
      if (y > box.top + box.height / 2) slot++;
    }
    return slot;
  }

  function finish(name: string, slot: number) {
    const others = names.filter((n) => n !== name);
    const next = [...others.slice(0, slot), name, ...others.slice(slot)];
    if (next.some((n, i) => n !== names[i])) onOrder(next);
  }

  const others = drag ? names.filter((n) => n !== drag.name) : names;
  return (
    <div ref={list} className={`flex flex-col ${gap}`}>
      {names.map((name) => {
        const dragging = drag?.name === name;
        // The line that shows where the row would land: above the first row that would come after it.
        const above = drag && !dragging && others[drag.before] === name;
        const handle = (
          <button
            type="button"
            className="shrink-0 cursor-grab touch-none select-none px-1 text-xl leading-none text-ink-faint hover:text-ink-muted active:cursor-grabbing"
            aria-label={`Drag to move ${name}`}
            title="Drag to change the order"
            onPointerDown={(e) => {
              if (names.length < 2) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({ name, before: names.indexOf(name) });
            }}
            onPointerMove={(e) => {
              if (drag?.name === name) setDrag({ name, before: slotAt(name, e.clientY) });
            }}
            onPointerUp={() => {
              if (drag?.name === name) finish(name, drag.before);
              setDrag(null);
            }}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              // The same from the keyboard: arrows move the row one place.
              const i = names.indexOf(name);
              const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
              if (to < 0 || to >= names.length) return;
              e.preventDefault();
              const next = [...names];
              [next[i], next[to]] = [next[to], next[i]];
              onOrder(next);
            }}
          >
            ⠿
          </button>
        );
        return (
          <div key={name} data-reorder={name} className={`relative ${dragging ? "opacity-50" : ""}`}>
            {above && <div className="absolute -top-2.5 left-0 right-0 h-0.5 rounded bg-accent" aria-hidden />}
            {children(name, handle)}
          </div>
        );
      })}
      {drag && drag.before >= others.length && others.length > 0 && <div className="-mt-2.5 h-0.5 rounded bg-accent" aria-hidden />}
    </div>
  );
}
