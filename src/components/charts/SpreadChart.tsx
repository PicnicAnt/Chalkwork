"use client";

import { useDeferredValue, useMemo } from "react";
import type { Visualization } from "@/lib/visualizations";
import { seededRandom, summarize, triangular } from "@/lib/spread";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, finite, W, INK, MUTED, FAINT } from "./common";

// Spread: how uncertain a result is. Each input that has a lowest and a highest value is drawn at random between
// them (most often near the value it has now), the board is solved for every draw, and the results are counted.

const DEFAULT_SAMPLES = 300;
const MAX_SAMPLES = 1000;
const BINS = 20;

export function SpreadChart({ viz, values }: { viz: Visualization; values: VizValues }) {
  const yName = viz.map.y;
  const y0 = values.number(yName);
  const samples = Math.min(MAX_SAMPLES, Math.max(20, Math.round(viz.options?.samples ?? DEFAULT_SAMPLES)));
  const chosen = viz.lists?.inputs;
  const sig = useDeferredValue(values.signature);

  const spread = useMemo(() => {
    if (!yName) return null;
    const names = (chosen && chosen.length > 0 ? chosen : values.inputs()).filter((n) => n !== yName);
    const varied = names.flatMap((name) => {
      const range = values.range(name);
      const now = values.number(name);
      return range?.min !== undefined && range.max !== undefined && finite(now) ? [{ name, min: range.min, max: range.max, now }] : [];
    });
    if (varied.length === 0) return { varied };
    const rand = seededRandom(12345);
    const results: number[] = [];
    for (let i = 0; i < samples; i++) {
      const draw = Object.fromEntries(varied.map((v) => [v.name, triangular(v.min, v.now, v.max, rand())]));
      const y = values.evaluate(draw)?.[yName];
      if (finite(y)) results.push(y);
    }
    return { varied, summary: summarize(results, BINS) };
    // The values object is new on every render; what it was built from is in the signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, yName, samples, chosen]);

  if (!yName) return <Note>Choose the result to look at.</Note>;
  if (values.isLocked(yName)) return <Note>{values.name(yName)} is locked, so it can&apos;t change. Unlock it to see the chart.</Note>;
  if (!spread) return null;
  if (spread.varied.length === 0)
    return <Note>Give the inputs a lowest and a highest value (in the variable editor) and type values for them, then the spread of {values.name(yName)} is drawn here.</Note>;
  const s = spread.summary;
  if (!s) return <Note>The board can&apos;t be solved for {values.name(yName)} with these ranges.</Note>;

  const H = 240;
  const m = { l: 14, r: 14, t: 18, b: 58 };
  const top = Math.max(...s.bins, 1);
  const span = s.max - s.min || 1;
  const px = (y: number) => m.l + ((y - s.min) / span) * (W - m.l - m.r);
  const barW = (W - m.l - m.r) / BINS;
  const base = H - m.b;
  const marks = [
    { at: s.p5, label: "5%" },
    { at: s.p95, label: "95%" },
  ];

  return (
    <Figure caption={`How ${values.name(yName)} could turn out`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Spread of ${values.name(yName)}`} className="mx-auto block w-full max-w-md">
        {s.bins.map((count, i) => {
          const h = (count / top) * (base - m.t);
          const mid = s.min + ((i + 0.5) / BINS) * span;
          return <rect key={i} x={m.l + i * barW + 1} y={base - h} width={barW - 2} height={h} rx={2} fill={mid >= s.p5 && mid <= s.p95 ? "var(--accent)" : "var(--accent-2)"} fillOpacity={0.7} stroke={INK} strokeWidth={0.8} />;
        })}
        <line x1={m.l} y1={base} x2={W - m.r} y2={base} stroke={MUTED} />
        {marks.map((mk) => (
          <g key={mk.label}>
            <line x1={px(mk.at)} y1={m.t - 4} x2={px(mk.at)} y2={base} stroke={FAINT} strokeWidth={1.5} strokeDasharray="3 3" />
            <Text x={px(mk.at)} y={base + 18} size={13} fill={MUTED}>
              {short(mk.at)}
            </Text>
            <Text x={px(mk.at)} y={base + 32} size={11} fill={MUTED}>
              {mk.label}
            </Text>
          </g>
        ))}
        {finite(y0) && y0 >= s.min && y0 <= s.max && (
          <g>
            <line x1={px(y0)} y1={m.t - 4} x2={px(y0)} y2={base} stroke={INK} strokeWidth={1.5} />
            <Text x={px(y0)} y={m.t - 6} size={12}>
              now
            </Text>
          </g>
        )}
        <Text x={m.l} y={H - 6} anchor="start" size={12} fill={MUTED}>
          {short(s.min)}
        </Text>
        <Text x={W - m.r} y={H - 6} anchor="end" size={12} fill={MUTED}>
          {short(s.max)}
        </Text>
      </svg>
      <p className="text-center text-base text-ink-muted">
        Nine times out of ten between {short(s.p5)} and {short(s.p95)}
        {values.unit(yName) ? ` ${values.unit(yName)}` : ""}, typically around {short(s.p50)}. {s.count} draws, varying{" "}
        {spread.varied.map((v) => values.name(v.name)).join(", ")}.
      </p>
    </Figure>
  );
}
