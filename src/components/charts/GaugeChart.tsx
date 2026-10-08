"use client";

import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, finite, W, MUTED, FAINT } from "./common";

// Gauge: one value on a dial between a lowest and a highest value.

export function GaugeChart({ viz, values }: { viz: Visualization; values: VizValues }) {
  const name = viz.map.value;
  const v = values.number(name);
  const lo = viz.options?.min ?? 0;
  const hi = viz.options?.max ?? 100;
  if (!name) return <Note>Choose the value to show.</Note>;
  if (!finite(v)) return <Note>The gauge is drawn once {values.name(name)} has a value.</Note>;
  if (!(hi > lo)) return <Note>The highest value must be above the lowest.</Note>;

  const frac = Math.min(Math.max((v - lo) / (hi - lo), 0), 1);
  const [cx, cy, R] = [W / 2, 150, 104];
  const phi = Math.PI * frac;
  const end = [cx - R * Math.cos(phi), cy - R * Math.sin(phi)];
  return (
    <Figure caption={values.name(name)}>
      <svg viewBox={`0 0 ${W} 200`} role="img" aria-label={`Gauge: ${values.name(name)} ${values.text(name)}`} className="mx-auto block w-full max-w-sm">
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke={FAINT} strokeWidth={18} strokeLinecap="round" />
        {frac > 0 && <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${end[0]} ${end[1]}`} fill="none" stroke="var(--accent)" strokeWidth={18} strokeLinecap="round" />}
        <Text x={cx} y={cy - 18} size={34}>
          {values.text(name)}
        </Text>
        <Text x={cx - R} y={cy + 24} size={14} fill={MUTED}>
          {short(lo)}
        </Text>
        <Text x={cx + R} y={cy + 24} size={14} fill={MUTED}>
          {short(hi)}
        </Text>
      </svg>
    </Figure>
  );
}
