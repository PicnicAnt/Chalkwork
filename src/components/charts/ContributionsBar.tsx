"use client";

import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, finite, W, INK, MUTED, PALETTE } from "./common";

// Contributions: how much each board in a collection adds to one of its totals (which sword carries the damage),
// as one bar divided between the boards that are switched on.

export function ContributionsBar({ viz, values }: { viz: Visualization; values: VizValues }) {
  const totalName = viz.map.total;
  if (!totalName) return <Note>Choose a total of a collection, such as parts.weight.</Note>;
  const parts = values.contributors(totalName);
  if (parts.length === 0) return <Note>{values.name(totalName)} is not a total of a collection that has boards in it yet.</Note>;
  const shown = parts.filter((p) => finite(p.value) && p.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const total = shown.reduce((sum, p) => sum + Math.max(p.value, 0), 0);
  if (shown.length === 0 || total <= 0) return <Note>Nothing adds to {values.name(totalName)} yet: add boards, or switch some on.</Note>;

  const left = 12;
  const width = W - 24;
  const rowH = 22;
  const H = 70 + shown.length * rowH;
  const unit = values.unit(totalName);

  return (
    <Figure caption={`What adds to ${values.name(totalName)}: ${values.text(totalName)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Contributions to ${values.name(totalName)}`} className="mx-auto block w-full max-w-md">
        {shown.map((p, i) => {
          const w = (Math.max(p.value, 0) / total) * width;
          const x = left + (shown.slice(0, i).reduce((sum, q) => sum + Math.max(q.value, 0), 0) / total) * width;
          return <rect key={i} x={x} y={14} width={Math.max(w, 0)} height={34} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.7} stroke={INK} strokeWidth={1.5} />;
        })}
        {shown.map((p, i) => (
          <g key={`l${i}`}>
            <rect x={left} y={64 + i * rowH - 11} width={14} height={14} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.7} stroke={INK} strokeWidth={1.5} />
            <Text x={left + 22} y={64 + i * rowH + 1} anchor="start" size={14}>
              {p.name.slice(0, 28)}
            </Text>
            <Text x={W - 12} y={64 + i * rowH + 1} anchor="end" size={14} fill={MUTED}>
              {short(p.value)}
              {unit ? " " + unit : ""} · {short((Math.max(p.value, 0) / total) * 100)}%
            </Text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}
