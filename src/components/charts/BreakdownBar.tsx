"use client";

import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, finite, W, INK, MUTED, PALETTE } from "./common";

// Breakdown: how a total divides into parts, and what is left over.

export function BreakdownBar({ viz, values }: { viz: Visualization; values: VizValues }) {
  const totalName = viz.map.total;
  const total = values.number(totalName);
  const parts = (viz.lists?.parts ?? []).map((name) => ({ name, n: values.number(name) }));
  if (!totalName || parts.length === 0) return <Note>Choose the total and its parts.</Note>;
  if (!finite(total) || total <= 0) return <Note>The chart is drawn once {values.name(totalName)} is above zero.</Note>;
  if (parts.some((p) => !finite(p.n))) return <Note>The chart is drawn once every part has a value.</Note>;

  const used = parts.reduce((sum, p) => sum + Math.max(p.n as number, 0), 0);
  const rest = total - used;
  const whole = Math.max(total, used);
  const segments = [
    ...parts.map((p, i) => ({ label: values.fullName(p.name), value: p.n as number, text: values.text(p.name), color: PALETTE[i % PALETTE.length], rest: false })),
    ...(rest > total * 1e-6 ? [{ label: "What is left", value: rest, text: `${short(rest)}${values.unit(totalName) ? " " + values.unit(totalName) : ""}`, color: "transparent", rest: true }] : []),
  ];
  const left = 12;
  const width = W - 24;
  let cursor = left;
  const rowH = 22;
  const H = 70 + segments.length * rowH;

  return (
    <Figure caption={`${values.name(totalName)}: ${values.text(totalName)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Breakdown of ${values.name(totalName)}`} className="mx-auto block w-full max-w-md">
        {segments.map((s, i) => {
          const w = (Math.max(s.value, 0) / whole) * width;
          const x = cursor;
          cursor += w;
          return <rect key={i} x={x} y={14} width={Math.max(w, 0)} height={34} fill={s.color} fillOpacity={s.rest ? 0 : 0.7} stroke={s.rest ? MUTED : INK} strokeWidth={1.5} strokeDasharray={s.rest ? "5 4" : undefined} />;
        })}
        {segments.map((s, i) => (
          <g key={`l${i}`}>
            <rect x={left} y={64 + i * rowH - 11} width={14} height={14} fill={s.color} fillOpacity={s.rest ? 0 : 0.7} stroke={s.rest ? MUTED : INK} strokeWidth={1.5} strokeDasharray={s.rest ? "3 2" : undefined} />
            <Text x={left + 22} y={64 + i * rowH + 1} anchor="start" size={14}>
              {s.label.slice(0, 28)}
            </Text>
            <Text x={W - 12} y={64 + i * rowH + 1} anchor="end" size={14} fill={MUTED}>
              {s.text} · {short((Math.max(s.value, 0) / whole) * 100)}%
            </Text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}
