"use client";

import { useMemo, type ReactNode } from "react";
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
  }, [values.signature, xName, yName, x0, optFrom, optTo]);

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
  }, [values.signature, yName, y0, percent, chosen]);

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
