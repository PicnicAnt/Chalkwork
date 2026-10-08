"use client";

import { useDeferredValue, useMemo } from "react";
import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, withUnit, finite, W, INK, MUTED, FAINT, FONT } from "./common";

// Sweep: how one variable changes as another goes across a range.

const POINTS = 41;

export function SweepChart({ viz, values }: { viz: Visualization; values: VizValues }) {
  const [xName, yName] = [viz.map.x, viz.map.y];
  const x0 = values.number(xName);
  const y0 = values.number(yName);
  const { from: optFrom, to: optTo } = viz.options ?? {};
  // Solving the board again is the slow part; it waits until typing has paused.
  const sig = useDeferredValue(values.signature);

  const line = useMemo(() => {
    if (!finite(x0)) return null;
    const from = optFrom ?? (x0 > 0 ? x0 * 0.5 : x0 < 0 ? x0 * 1.5 : 0);
    const to = optTo ?? (x0 > 0 ? x0 * 1.5 : x0 < 0 ? x0 * 0.5 : 1);
    if (!(to > from)) return null;
    const points = Array.from({ length: POINTS }, (_, i) => {
      const x = from + ((to - from) * i) / (POINTS - 1);
      const y = values.evaluate({ [xName]: x })?.[yName];
      return { x, y: finite(y) ? y : undefined };
    });
    return { from, to, points };
    // The values object is new on every render; what it was built from is in the signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, xName, yName, x0, optFrom, optTo]);

  if (!xName || !yName) return <Note>Choose both axes to draw the chart.</Note>;
  if (xName === yName) return <Note>Choose two different variables.</Note>;
  if (!finite(x0)) return <Note>The chart is drawn once {values.name(xName)} has a value.</Note>;
  if (values.isLocked(yName)) return <Note>{values.name(yName)} is locked, so it can&apos;t change. Unlock it to see the chart.</Note>;
  if (!line) return <Note>The range must go from a lower to a higher number.</Note>;
  const ys = line.points.flatMap((p) => (p.y === undefined ? [] : [p.y]));
  if (ys.length === 0) return <Note>The board can&apos;t be solved for {values.name(yName)} in this range.</Note>;

  const H = 250;
  const m = { l: 76, r: 18, t: 16, b: 52 };
  let [lo, hi] = [Math.min(...ys), Math.max(...ys)];
  if (finite(y0)) [lo, hi] = [Math.min(lo, y0), Math.max(hi, y0)];
  if (hi === lo) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.08;
  [lo, hi] = [lo - pad, hi + pad];
  const px = (x: number) => m.l + ((x - line.from) / (line.to - line.from)) * (W - m.l - m.r);
  const py = (y: number) => H - m.b - ((y - lo) / (hi - lo)) * (H - m.t - m.b);

  let path = "";
  let pen = false;
  for (const p of line.points) {
    if (p.y === undefined) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"} ${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)} `;
    pen = true;
  }
  const xTicks = [line.from, (line.from + line.to) / 2, line.to];
  const yTicks = [lo + pad, (lo + hi) / 2, hi - pad];

  return (
    <Figure caption={`${values.name(yName)} against ${values.name(xName)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Chart of ${values.name(yName)} against ${values.name(xName)}`} className="mx-auto block w-full max-w-md">
        <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="none" stroke={FAINT} strokeWidth={1.5} />
        {xTicks.map((t, i) => (
          <g key={`x${i}`}>
            <line x1={px(t)} y1={H - m.b} x2={px(t)} y2={H - m.b + 5} stroke={MUTED} />
            <Text x={px(t)} y={H - m.b + 20} size={13} fill={MUTED}>
              {short(t)}
            </Text>
          </g>
        ))}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line x1={m.l - 5} y1={py(t)} x2={m.l} y2={py(t)} stroke={MUTED} />
            <line x1={m.l} y1={py(t)} x2={W - m.r} y2={py(t)} stroke={FAINT} strokeDasharray="3 5" />
            <Text x={m.l - 8} y={py(t) + 4} anchor="end" size={13} fill={MUTED}>
              {short(t)}
            </Text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {finite(y0) && x0 >= line.from && x0 <= line.to && (
          <g>
            <line x1={px(x0)} y1={py(y0)} x2={px(x0)} y2={H - m.b} stroke={MUTED} strokeDasharray="4 4" />
            <circle cx={px(x0)} cy={py(y0)} r={5} fill="var(--accent)" stroke={INK} strokeWidth={1.5} />
          </g>
        )}
        <Text x={(m.l + W - m.r) / 2} y={H - 10} size={14}>
          {withUnit(values, xName)}
        </Text>
        <text transform={`rotate(-90 12 ${H / 2})`} x={12} y={H / 2} textAnchor="middle" fontSize={14} fill={INK} style={{ fontFamily: FONT }}>
          {withUnit(values, yName)}
        </text>
      </svg>
      <p className="text-center text-base text-ink-muted">
        Now: {values.text(xName)} gives {values.text(yName)}
      </p>
    </Figure>
  );
}
