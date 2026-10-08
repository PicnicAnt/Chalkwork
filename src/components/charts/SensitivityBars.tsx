"use client";

import { useDeferredValue, useMemo } from "react";
import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, finite, W, INK, MUTED } from "./common";

// Sensitivity: how much the result moves when each input goes a little up or down.

export function SensitivityBars({ viz, values }: { viz: Visualization; values: VizValues }) {
  const yName = viz.map.y;
  const y0 = values.number(yName);
  const percent = viz.options?.percent && viz.options.percent > 0 ? viz.options.percent : 10;
  const chosen = viz.lists?.inputs;
  const sig = useDeferredValue(values.signature);

  const rows = useMemo(() => {
    if (!yName || !finite(y0)) return null;
    const names = (chosen && chosen.length > 0 ? chosen : values.inputs()).filter((n) => n !== yName);
    const out: { name: string; low: number; high: number }[] = [];
    for (const name of names) {
      const v = values.number(name);
      if (!finite(v) || v === 0) continue;
      const low = values.evaluate({ [name]: v * (1 - percent / 100) })?.[yName];
      const high = values.evaluate({ [name]: v * (1 + percent / 100) })?.[yName];
      if (finite(low) && finite(high)) out.push({ name, low, high });
    }
    return out.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, yName, y0, percent, chosen]);

  if (!yName) return <Note>Choose the result to look at.</Note>;
  if (!finite(y0)) return <Note>The chart is drawn once {values.name(yName)} has a value.</Note>;
  if (values.isLocked(yName)) return <Note>{values.name(yName)} is locked, so it can&apos;t change. Unlock it to see the chart.</Note>;
  if (!rows || rows.length === 0) return <Note>No input changes {values.name(yName)} here. Type values for the inputs, or choose which ones to vary.</Note>;

  const rowH = 24;
  const top = 12;
  const H = top + rows.length * rowH + 40;
  const left = 150;
  const right = W - 56;
  const lo = Math.min(y0, ...rows.map((r) => Math.min(r.low, r.high)));
  const hi = Math.max(y0, ...rows.map((r) => Math.max(r.low, r.high)));
  const span = hi - lo || 1;
  const px = (y: number) => left + ((y - lo) / span) * (right - left);

  return (
    <Figure caption={`What moves ${values.name(yName)} (inputs ±${percent}%)`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sensitivity of ${values.name(yName)}`} className="mx-auto block w-full max-w-md">
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const x1 = px(Math.min(r.low, r.high));
          const x2 = px(Math.max(r.low, r.high));
          const swing = ((r.high - r.low) / Math.abs(y0 || 1)) * 100;
          return (
            <g key={r.name}>
              <Text x={left - 8} y={y + 16} anchor="end" size={13}>
                {values.fullName(r.name).slice(0, 26)}
              </Text>
              <rect x={x1} y={y + 3} width={Math.max(x2 - x1, 2)} height={rowH - 8} rx={3} fill={swing >= 0 ? "var(--accent)" : "var(--op)"} fillOpacity={0.75} stroke={INK} strokeWidth={1} />
              <Text x={right + 6} y={y + 16} anchor="start" size={13} fill={MUTED}>
                {swing >= 0 ? "+" : "−"}
                {Math.abs(swing) < 10 ? Math.abs(swing).toFixed(1) : Math.round(Math.abs(swing))}%
              </Text>
            </g>
          );
        })}
        <line x1={px(y0)} y1={top - 4} x2={px(y0)} y2={top + rows.length * rowH + 2} stroke={INK} strokeWidth={1.5} strokeDasharray="4 3" />
        <Text x={px(y0)} y={top + rows.length * rowH + 20} size={13} fill={MUTED}>
          now: {values.text(yName)}
        </Text>
      </svg>
      <p className="text-center text-base text-ink-muted">
        Each bar runs from the result with the input {percent}% lower to {percent}% higher.
      </p>
    </Figure>
  );
}
