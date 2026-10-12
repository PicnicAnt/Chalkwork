"use client";

import { useState } from "react";
import { toLocaleText } from "@/lib/locale";
import { useNumberLocale } from "./useNumberLocale";

export type ResultItem = { name: string; label: string; value: string; unit?: string };

// The values the formulas work out, kept in view while the board is scrolled, so a change made far down the list
// can be seen working through. Tapping one goes to its field.
export function ResultsBar({ items, onGo }: { items: ResultItem[]; onGo: (name: string) => void }) {
  const loc = useNumberLocale();
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div className="results-bar sticky top-0 z-20 -mx-2 px-2 py-1.5">
      <div className="flex items-baseline gap-3">
        <button
          type="button"
          className="shrink-0 text-base text-ink-muted hover:text-accent"
          aria-expanded={open}
          title={open ? "Hide the results strip" : "Show the results strip"}
          onClick={() => setOpen((o) => !o)}
        >
          Results {open ? "▾" : "▸"}
        </button>
        {open && (
          <ul className="flex min-w-0 flex-1 items-baseline gap-x-4 overflow-x-auto whitespace-nowrap pb-0.5">
            {items.map((r) => (
              <li key={r.name} className="shrink-0">
                <button type="button" className="text-lg hover:text-accent" onClick={() => onGo(r.name)} title={`Go to ${r.label}`}>
                  <span className="text-ink-muted">{r.label}</span> = <strong className="font-normal">{toLocaleText(r.value, loc)}</strong>
                  {r.unit ? <span className="text-ink-muted"> {r.unit}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
