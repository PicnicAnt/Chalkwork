"use client";

import { useDeferredValue, useMemo } from "react";
import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "../viz-values";
import { Text, Note, Figure, short, withUnit, finite, W, INK, MUTED, FAINT, FONT } from "./common";

// Heat map: one result over a grid of two inputs.

const GRID = 9;

export function HeatMap({ viz, values }: { viz: Visualization; values: VizValues }) {
  const [xName, yName, zName] = [viz.map.x, viz.map.y, viz.map.z];
  const x0 = values.number(xName);
  const y0 = values.number(yName);
  const z0 = values.number(zName);
  const o = viz.options ?? {};
  const sig = useDeferredValue(values.signature);

  const grid = useMemo(() => {
    if (!finite(x0) || !finite(y0)) return null;
    const range = (v: number, from?: number, to?: number): [number, number] => [from ?? (v > 0 ? v * 0.5 : v < 0 ? v * 1.5 : 0), to ?? (v > 0 ? v * 1.5 : v < 0 ? v * 0.5 : 1)];
    const [xf, xt] = range(x0, o.x_from, o.x_to);
    const [yf, yt] = range(y0, o.y_from, o.y_to);
    if (!(xt > xf) || !(yt > yf)) return null;
    const cells = Array.from({ length: GRID }, (_, j) =>
      Array.from({ length: GRID }, (_, i) => {
        const x = xf + ((xt - xf) * i) / (GRID - 1);
        const y = yf + ((yt - yf) * j) / (GRID - 1);
        const z = values.evaluate({ [xName]: x, [yName]: y })?.[zName];
        return { x, y, z: finite(z) ? z : undefined };
      }),
    );
    return { xf, xt, yf, yt, cells };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, xName, yName, zName, x0, y0, o.x_from, o.x_to, o.y_from, o.y_to]);

  if (!xName || !yName || !zName) return <Note>Choose both inputs and the result.</Note>;
  if (new Set([xName, yName, zName]).size < 3) return <Note>Choose three different variables.</Note>;
  if (!finite(x0) || !finite(y0)) return <Note>The map is drawn once both inputs have values.</Note>;
  if (values.isLocked(zName)) return <Note>{values.name(zName)} is locked, so it can&apos;t change. Unlock it to see the map.</Note>;
  if (!grid) return <Note>Each range must go from a lower to a higher number.</Note>;
  const zs = grid.cells.flat().flatMap((c) => (c.z === undefined ? [] : [c.z]));
  if (zs.length === 0) return <Note>The board can&apos;t be solved for {values.name(zName)} in these ranges.</Note>;

  const H = 290;
  const m = { l: 76, r: 18, t: 14, b: 76 };
  const [zlo, zhi] = [Math.min(...zs), Math.max(...zs)];
  const cw = (W - m.l - m.r) / GRID;
  const ch = (H - m.t - m.b) / GRID;
  const px = (x: number) => m.l + ((x - grid.xf) / (grid.xt - grid.xf)) * (W - m.l - m.r);
  const py = (y: number) => H - m.b - ((y - grid.yf) / (grid.yt - grid.yf)) * (H - m.t - m.b);

  return (
    <Figure caption={`${values.name(zName)} across ${values.name(xName)} and ${values.name(yName)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Heat map of ${values.name(zName)}`} className="mx-auto block w-full max-w-md">
        {grid.cells.map((row, j) =>
          row.map((c, i) => (
            <rect key={`${i}-${j}`} x={m.l + i * cw} y={H - m.b - (j + 1) * ch} width={cw + 0.5} height={ch + 0.5} fill="var(--accent)" fillOpacity={c.z === undefined ? 0 : 0.07 + 0.88 * (zhi === zlo ? 0.5 : (c.z - zlo) / (zhi - zlo))}>
              <title>{`${short(c.x)}, ${short(c.y)}: ${c.z === undefined ? "no solution" : short(c.z)}`}</title>
            </rect>
          )),
        )}
        <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="none" stroke={FAINT} strokeWidth={1.5} />
        {[grid.xf, (grid.xf + grid.xt) / 2, grid.xt].map((t, i) => (
          <Text key={`x${i}`} x={px(t)} y={H - m.b + 18} size={13} fill={MUTED}>
            {short(t)}
          </Text>
        ))}
        {[grid.yf, (grid.yf + grid.yt) / 2, grid.yt].map((t, i) => (
          <Text key={`y${i}`} x={m.l - 8} y={py(t) + 4} anchor="end" size={13} fill={MUTED}>
            {short(t)}
          </Text>
        ))}
        {x0 >= grid.xf && x0 <= grid.xt && y0 >= grid.yf && y0 <= grid.yt && <circle cx={px(x0)} cy={py(y0)} r={6} fill="none" stroke={INK} strokeWidth={2.5} />}
        <Text x={(m.l + W - m.r) / 2} y={H - m.b + 38} size={14}>
          {withUnit(values, xName)}
        </Text>
        <text transform={`rotate(-90 12 ${(m.t + H - m.b) / 2})`} x={12} y={(m.t + H - m.b) / 2} textAnchor="middle" fontSize={14} fill={INK} style={{ fontFamily: FONT }}>
          {withUnit(values, yName)}
        </text>
        <defs>
          <linearGradient id="heat-scale">
            <stop offset="0" stopColor="var(--accent)" stopOpacity={0.07} />
            <stop offset="1" stopColor="var(--accent)" stopOpacity={0.95} />
          </linearGradient>
        </defs>
        <rect x={m.l} y={H - 20} width={W - m.l - m.r} height={8} fill="url(#heat-scale)" stroke={FAINT} />
        <Text x={m.l} y={H - 24} anchor="start" size={12} fill={MUTED}>
          {short(zlo)}
        </Text>
        <Text x={W - m.r} y={H - 24} anchor="end" size={12} fill={MUTED}>
          {short(zhi)} {values.unit(zName)}
        </Text>
      </svg>
      {finite(z0) && <p className="text-center text-base text-ink-muted">The ring marks now: {values.text(zName)}</p>}
    </Figure>
  );
}
