"use client";

import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, finite, W, INK, MUTED, PALETTE } from "./common";

// Pie: how a whole divides into shares.

export function PieChart({ viz, values }: { viz: Visualization; values: VizValues }) {
  const names = viz.lists?.parts ?? [];
  if (names.length === 0) return <Note>Choose the parts of the pie.</Note>;
  const parts = names.map((n) => ({ name: n, v: values.number(n) }));
  if (parts.some((p) => !finite(p.v))) return <Note>The chart is drawn once every part has a value.</Note>;

  const totalName = viz.map.total;
  const total = totalName ? values.number(totalName) : undefined;
  const used = parts.reduce((sum, p) => sum + Math.max(p.v as number, 0), 0);
  const whole = finite(total) && total > used ? total : used;
  if (!(whole > 0)) return <Note>The parts add up to zero, so there is nothing to draw.</Note>;
  const slices = [
    ...parts.map((p, i) => ({ label: values.fullName(p.name), value: Math.max(p.v as number, 0), color: PALETTE[i % PALETTE.length], rest: false })),
    ...(whole - used > whole * 1e-6 ? [{ label: "What is left", value: whole - used, color: "transparent", rest: true }] : []),
  ];
  const [cx, cy, R] = [90, 100, 76];
  const H = Math.max(200, 30 + slices.length * 24);
  let angle = -Math.PI / 2;
  return (
    <Figure caption={totalName ? `${values.name(totalName)} divided` : "Shares"}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pie chart" className="mx-auto block w-full max-w-md">
        {slices.map((s, i) => {
          const sweep = (s.value / whole) * 2 * Math.PI;
          const a0 = angle;
          const a1 = angle + sweep;
          angle = a1;
          const [x0, y0, x1, y1] = [cx + R * Math.cos(a0), cy + R * Math.sin(a0), cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
          const d = sweep >= 2 * Math.PI - 1e-6 ? `M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0` : `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`;
          return <path key={i} d={d} fill={s.color} fillOpacity={s.rest ? 0 : 0.7} stroke={s.rest ? MUTED : INK} strokeWidth={1.5} strokeDasharray={s.rest ? "5 4" : undefined} />;
        })}
        {slices.map((s, i) => (
          <g key={`l${i}`}>
            <rect x={188} y={20 + i * 24} width={14} height={14} fill={s.color} fillOpacity={s.rest ? 0 : 0.7} stroke={s.rest ? MUTED : INK} strokeWidth={1.5} strokeDasharray={s.rest ? "3 2" : undefined} />
            <Text x={208} y={32 + i * 24} anchor="start" size={13}>
              {s.label.slice(0, 18)} · {short((s.value / whole) * 100)}%
            </Text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}
