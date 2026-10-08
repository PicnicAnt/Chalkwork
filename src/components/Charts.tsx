"use client";

import { useDeferredValue, useMemo, type ReactNode } from "react";
import type { Visualization } from "@/lib/visualizations";
import type { VizValues } from "./viz-values";

// Charts. Unlike the shapes, these solve the board again with other values: that is what makes a chart
// of an equation system more than a picture. They are given the board through `VizValues` only.

const W = 360;
const INK = "var(--ink)";
const MUTED = "var(--ink-muted)";
const FAINT = "var(--ink-faint)";
const FONT = "var(--font-hand), cursive";
const PALETTE = ["var(--accent)", "var(--accent-2)", "var(--op)", "var(--note)", "var(--danger)"];

function Text({ x, y, anchor = "middle", size = 14, fill = INK, children }: { x: number; y: number; anchor?: "start" | "middle" | "end"; size?: number; fill?: string; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} style={{ fontFamily: FONT }}>
      {children}
    </text>
  );
}

// A number written briefly: four significant digits, thousands separated.
const short = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
const withUnit = (v: VizValues, name: string) => (v.unit(name) ? `${v.name(name)} (${v.unit(name)})` : v.name(name));
const finite = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);

function Note({ children }: { children: ReactNode }) {
  return <p className="text-base text-ink-muted">{children}</p>;
}

function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-center text-lg text-ink-muted">{caption}</figcaption>
      {children}
    </figure>
  );
}

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Dependency diagram: how a result is built up from the variables behind it.

export function DependencyDiagram({ viz, values }: { viz: Visualization; values: VizValues }) {
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
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((col, ci) => col.forEach((n, ri) => pos.set(n, { x: 8 + ci * (nodeW + gapX), y: 8 + ri * (nodeH + gapY) })));

  return (
    <Figure caption={`How ${values.name(target)} is worked out`}>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={Math.min(width, 760)} role="img" aria-label={`Dependency diagram of ${values.name(target)}`} className="mx-auto block max-w-none">
          {shownEdges.map(([a, b], i) => {
            const [pa, pb] = [pos.get(a), pos.get(b)];
            if (!pa || !pb) return null;
            const [x1, y1, x2, y2] = [pa.x + nodeW, pa.y + nodeH / 2, pb.x, pb.y + nodeH / 2];
            const pull = Math.max(16, Math.abs(x2 - x1) / 2);
            return <path key={i} d={`M ${x1} ${y1} C ${x1 + pull} ${y1}, ${x2 - pull} ${y2}, ${x2} ${y2}`} fill="none" stroke={MUTED} strokeWidth={1.5} />;
          })}
          {order.map((n) => {
            const p = pos.get(n);
            if (!p) return null;
            const locked = values.isLocked(n);
            return (
              <g key={n}>
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
