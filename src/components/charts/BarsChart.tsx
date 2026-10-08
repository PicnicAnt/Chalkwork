"use client";

import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, finite, W, INK, MUTED, PALETTE } from "./common";

// Bars: several variables side by side.

export function BarsChart({ viz, values }: { viz: Visualization; values: VizValues }) {
  const names = viz.lists?.values ?? [];
  if (names.length === 0) return <Note>Choose the variables to compare.</Note>;
  const items = names.map((n) => ({ name: n, v: values.number(n) }));
  if (items.some((i) => !finite(i.v))) return <Note>The chart is drawn once every variable has a value.</Note>;

  const peak = Math.max(...items.map((i) => Math.abs(i.v as number))) || 1;
  const rowH = 30;
  const H = items.length * rowH + 14;
  const left = 150;
  const right = W - 70;
  return (
    <Figure caption="Side by side">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bars comparing variables" className="mx-auto block w-full max-w-md">
        {items.map((it, i) => {
          const y = 8 + i * rowH;
          const w = (Math.abs(it.v as number) / peak) * (right - left);
          return (
            <g key={it.name}>
              <Text x={left - 8} y={y + 18} anchor="end" size={13}>
                {values.fullName(it.name).slice(0, 26)}
              </Text>
              <rect x={left} y={y + 3} width={Math.max(w, 2)} height={rowH - 10} rx={3} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.75} stroke={INK} strokeWidth={1} />
              <Text x={left + Math.max(w, 2) + 6} y={y + 18} anchor="start" size={13} fill={MUTED}>
                {values.text(it.name)}
              </Text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}
