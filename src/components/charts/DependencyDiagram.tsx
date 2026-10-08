"use client";

import { useState } from "react";
import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, INK, MUTED } from "./common";

// Dependency diagram: how a result is built up from the variables behind it.

export function DependencyDiagram({ viz, values }: { viz: Visualization; values: VizValues }) {
  // The box the pointer is over (or that was tapped or focused): its connectors light up.
  const [active, setActive] = useState<string | null>(null);
  const target = viz.map.result;
  if (!target) return <Note>Choose the result to explain.</Note>;

  const defs = new Map<string, string[]>();
  for (const f of values.formulas()) if (!defs.has(f.name)) defs.set(f.name, f.vars.filter((n) => n !== f.name));
  if (!defs.has(target)) return <Note>{values.name(target)} isn&apos;t worked out from other variables, so there is nothing to explain.</Note>;

  const level = new Map<string, number>([[target, 0]]);
  const order = [target];
  const edges: [string, string][] = [];
  for (let i = 0; i < order.length && order.length < 28; i++) {
    const n = order[i];
    const l = level.get(n) as number;
    if (l >= 4) continue;
    for (const input of defs.get(n) ?? []) {
      edges.push([input, n]);
      if (!level.has(input) && order.length < 28) {
        level.set(input, l + 1);
        order.push(input);
      }
    }
  }
  const shownEdges = edges.filter(([a, b]) => level.has(a) && level.has(b));
  const deepest = Math.max(...level.values());
  const columns: string[][] = Array.from({ length: deepest + 1 }, () => []);
  for (const n of order) columns[deepest - (level.get(n) as number)].push(n);
  const [nodeW, nodeH, gapX, gapY] = [124, 42, 38, 14];
  const width = columns.length * nodeW + (columns.length - 1) * gapX + 16;
  const height = Math.max(...columns.map((c) => c.length)) * (nodeH + gapY) + 10;
  // A connector is lit when it runs into or out of the active box.
  const lit = ([a, b]: [string, string]) => active !== null && (a === active || b === active);
  const neighbours = new Set(active === null ? [] : shownEdges.filter(lit).flat());
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((col, ci) => col.forEach((n, ri) => pos.set(n, { x: 8 + ci * (nodeW + gapX), y: 8 + ri * (nodeH + gapY) })));

  return (
    <Figure caption={`How ${values.name(target)} is worked out`}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={Math.min(width, 760)} role="img" aria-label={`Dependency diagram of ${values.name(target)}`} className="mx-auto block max-w-none">
          {/* The lit connectors are drawn last, so they lie on top of the others. */}
          {[...shownEdges]
            .sort((e, f) => Number(lit(e)) - Number(lit(f)))
            .map(([a, b], i) => {
              const [pa, pb] = [pos.get(a), pos.get(b)];
              if (!pa || !pb) return null;
              const [x1, y1, x2, y2] = [pa.x + nodeW, pa.y + nodeH / 2, pb.x, pb.y + nodeH / 2];
              const pull = Math.max(16, Math.abs(x2 - x1) / 2);
              const on = lit([a, b]);
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${x1 + pull} ${y1}, ${x2 - pull} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={on ? "var(--accent)" : MUTED}
                  strokeWidth={on ? 3.5 : 1.5}
                  strokeOpacity={active && !on ? 0.25 : 1}
                  style={{ transition: "stroke-opacity 0.15s, stroke-width 0.15s" }}
                />
              );
            })}
          {order.map((n) => {
            const p = pos.get(n);
            if (!p) return null;
            const locked = values.isLocked(n);
            const near = active === null || n === active || neighbours.has(n);
            return (
              <g
                key={n}
                tabIndex={0}
                onMouseEnter={() => setActive(n)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(n)}
                onBlur={() => setActive(null)}
                onClick={() => {
                  setActive(n);
                  values.focus(n);
                }}
                opacity={near ? 1 : 0.4}
                style={{ cursor: "pointer", outline: "none", transition: "opacity 0.15s" }}
              >
                <rect x={p.x} y={p.y} width={nodeW} height={nodeH} rx={6} fill={locked ? "var(--accent)" : "none"} fillOpacity={locked ? 0.2 : 0} stroke={INK} strokeWidth={n === target ? 3 : 1.5} strokeDasharray={defs.has(n) || locked ? undefined : "4 3"} />
                <Text x={p.x + nodeW / 2} y={p.y + 18} size={13}>
                  {values.fullName(n).slice(0, 18)}
                </Text>
                <Text x={p.x + nodeW / 2} y={p.y + 35} size={12} fill={MUTED}>
                  {values.text(n).slice(0, 20)}
                </Text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-center text-base text-ink-muted">Arrows point from what is used to what it makes. Filled boxes are values you have typed.</p>
    </Figure>
  );
}
