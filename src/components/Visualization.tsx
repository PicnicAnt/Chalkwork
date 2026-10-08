import type { ReactNode } from "react";
import { vizType, type Visualization } from "@/lib/visualizations";
import { BarsChart, BreakdownBar, DependencyDiagram, GaugeChart, HeatMap, PieChart, SensitivityBars, SweepChart } from "./Charts";
import type { VizValues } from "./viz-values";

// The drawings. Each type is a function from its parameter values to SVG shapes; the board only says
// which variable feeds which parameter (see lib/visualizations.ts). Shapes keep their proportions,
// so a tall rectangle is drawn tall, and are scaled to fit the picture.
//
// What a drawing needs from the board is small: a number per parameter, and a way to write that number
// (with its unit). Nothing here knows about a particular board.

const W = 320;
const H = 210;
const PAD = 30;


const INK = "var(--ink)";
const MUTED = "var(--ink-muted)";
const FILL = "color-mix(in srgb, var(--accent) 14%, transparent)";
const STROKE = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const DASH = { stroke: MUTED, strokeWidth: 1.5, strokeDasharray: "5 4", fill: "none" };

function Label({ x, y, anchor = "middle", children }: { x: number; y: number; anchor?: "start" | "middle" | "end"; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={INK} fontSize={15} style={{ fontFamily: "var(--font-hand), cursive" }}>
      {children}
    </text>
  );
}

// A scale that makes a drawing of the given size fit inside the picture.
const fit = (width: number, height: number) => Math.min((W - 2 * PAD) / width, (H - 2 * PAD) / height);

type Drawn = { svg: ReactNode; summary: string };

function circle(v: Record<string, number>, t: (p: string) => string): Drawn {
  const r = 72;
  const cx = W / 2;
  const cy = H / 2;
  return {
    summary: `circle, radius ${t("radius")}`,
    svg: (
      <>
        <circle cx={cx} cy={cy} r={r} fill={FILL} {...STROKE} />
        <line x1={cx} y1={cy} x2={cx + r} y2={cy} {...STROKE} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        <Label x={cx + r / 2} y={cy - 8}>
          r = {t("radius")}
        </Label>
      </>
    ),
  };
}

function rectangle(v: Record<string, number>, t: (p: string) => string): Drawn {
  const s = fit(v.width, v.height);
  const w = v.width * s;
  const h = v.height * s;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  return {
    summary: `rectangle, ${t("width")} by ${t("height")}`,
    svg: (
      <>
        <rect x={x} y={y} width={w} height={h} fill={FILL} {...STROKE} />
        <Label x={W / 2} y={y + h + 19}>
          {t("width")}
        </Label>
        <Label x={x + w + 8} y={H / 2 + 5} anchor="start">
          {t("height")}
        </Label>
      </>
    ),
  };
}

function triangle(v: Record<string, number>, t: (p: string) => string): Drawn {
  const s = fit(v.base, v.height);
  const b = v.base * s;
  const h = v.height * s;
  const x = (W - b) / 2;
  const top = (H - h) / 2;
  const bottom = top + h;
  return {
    summary: `triangle, base ${t("base")}, height ${t("height")}`,
    svg: (
      <>
        <polygon points={`${x},${bottom} ${x + b},${bottom} ${W / 2},${top}`} fill={FILL} {...STROKE} />
        <line x1={W / 2} y1={top} x2={W / 2} y2={bottom} {...DASH} />
        <Label x={W / 2} y={bottom + 19}>
          {t("base")}
        </Label>
        <Label x={W / 2 + 6} y={(top + bottom) / 2 + 5} anchor="start">
          {t("height")}
        </Label>
      </>
    ),
  };
}

function cylinder(v: Record<string, number>, t: (p: string) => string): Drawn {
  // The ellipses are drawn at a fixed slant: a third as tall as they are wide.
  const squash = 0.32;
  const s = fit(2 * v.radius, v.height + 2 * v.radius * squash);
  const rx = v.radius * s;
  const ry = rx * squash;
  const h = v.height * s;
  const cx = W / 2;
  const top = (H - (h + 2 * ry)) / 2 + ry;
  const bottom = top + h;
  return {
    summary: `cylinder, radius ${t("radius")}, height ${t("height")}`,
    svg: (
      <>
        <path
          d={`M ${cx - rx} ${top} L ${cx - rx} ${bottom} A ${rx} ${ry} 0 0 0 ${cx + rx} ${bottom} L ${cx + rx} ${top}`}
          fill={FILL}
          {...STROKE}
        />
        <path d={`M ${cx - rx} ${bottom} A ${rx} ${ry} 0 0 1 ${cx + rx} ${bottom}`} {...DASH} />
        <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={FILL} {...STROKE} />
        <line x1={cx} y1={top} x2={cx + rx} y2={top} {...STROKE} strokeWidth={1.5} />
        <Label x={cx + rx / 2} y={top - ry - 5}>
          r = {t("radius")}
        </Label>
        <Label x={cx + rx + 10} y={(top + bottom) / 2 + 5} anchor="start">
          {t("height")}
        </Label>
      </>
    ),
  };
}

function pyramid(v: Record<string, number>, t: (p: string) => string): Drawn {
  // A slanted view from the front and a little above: the depth of the base recedes up and to the right.
  const kx = 0.5;
  const ky = 0.35;
  const dx = v.depth * kx;
  const dy = v.depth * ky;
  // In model units, with y pointing down: front edge at y = 0, back edge at y = -dy.
  const total = { w: v.width + dx, h: v.height + dy };
  const s = fit(total.w, total.h);
  const ox = (W - total.w * s) / 2;
  const oy = (H - total.h * s) / 2 + v.height * s;
  const P = (mx: number, my: number): [number, number] => [ox + mx * s, oy + my * s];
  const fl = P(0, 0);
  const fr = P(v.width, 0);
  const br = P(v.width + dx, -dy);
  const bl = P(dx, -dy);
  const centre = P(v.width / 2 + dx / 2, -dy / 2);
  const apex: [number, number] = [centre[0], centre[1] - v.height * s];
  const pt = (p: [number, number]) => `${p[0]},${p[1]}`;
  return {
    summary: `pyramid, base ${t("width")} by ${t("depth")}, height ${t("height")}`,
    svg: (
      <>
        <polygon points={`${pt(fl)} ${pt(fr)} ${pt(apex)}`} fill={FILL} {...STROKE} />
        <polygon points={`${pt(fr)} ${pt(br)} ${pt(apex)}`} fill={FILL} {...STROKE} />
        <polyline points={`${pt(fl)} ${pt(bl)} ${pt(br)}`} {...DASH} />
        <line x1={apex[0]} y1={apex[1]} x2={bl[0]} y2={bl[1]} {...DASH} />
        <line x1={apex[0]} y1={apex[1]} x2={centre[0]} y2={centre[1]} {...DASH} />
        <Label x={(fl[0] + fr[0]) / 2} y={fl[1] + 19}>
          {t("width")}
        </Label>
        <Label x={(fr[0] + br[0]) / 2 + 8} y={(fr[1] + br[1]) / 2 + 18} anchor="start">
          {t("depth")}
        </Label>
        <Label x={apex[0] + 10} y={(apex[1] + centre[1]) / 2 + 5} anchor="start">
          {t("height")}
        </Label>
      </>
    ),
  };
}

function donut(v: Record<string, number>, t: (p: string) => string): Drawn {
  // Seen from above: a ring, with a dashed circle through the middle of the dough.
  const outer = v.ring_radius + v.tube_radius;
  const inner = Math.max(v.ring_radius - v.tube_radius, 0);
  const s = 74 / outer;
  const cx = W / 2;
  const cy = H / 2;
  const R = outer * s;
  const r = inner * s;
  const mid = v.ring_radius * s;
  return {
    summary: `donut, ring radius ${t("ring_radius")}, dough radius ${t("tube_radius")}`,
    svg: (
      <>
        <path
          fillRule="evenodd"
          d={`M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`}
          fill={FILL}
          {...STROKE}
        />
        <circle cx={cx} cy={cy} r={mid} {...DASH} />
        <line x1={cx} y1={cy} x2={cx + mid} y2={cy} {...STROKE} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        <Label x={cx - R - 10} y={cy - 8} anchor="end">
          dough r = {t("tube_radius")}
        </Label>
        <Label x={cx + R + 10} y={cy + 5} anchor="start">
          R = {t("ring_radius")}
        </Label>
      </>
    ),
  };
}

function ellipse(v: Record<string, number>, t: (p: string) => string): Drawn {
  const s = fit(2 * v.radius_x, 2 * v.radius_y);
  const rx = v.radius_x * s;
  const ry = v.radius_y * s;
  const cx = W / 2;
  const cy = H / 2;
  return {
    summary: `ellipse, ${t("radius_x")} and ${t("radius_y")} from the middle`,
    svg: (
      <>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={FILL} {...STROKE} />
        <line x1={cx} y1={cy} x2={cx + rx} y2={cy} {...DASH} />
        <line x1={cx} y1={cy} x2={cx} y2={cy - ry} {...DASH} />
        <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        <Label x={cx + rx / 2} y={cy + 17}>
          a = {t("radius_x")}
        </Label>
        <Label x={cx + 6} y={cy - ry / 2} anchor="start">
          b = {t("radius_y")}
        </Label>
      </>
    ),
  };
}

function sphere(v: Record<string, number>, t: (p: string) => string): Drawn {
  const r = 72;
  const cx = W / 2;
  const cy = H / 2;
  return {
    summary: `sphere, radius ${t("radius")}`,
    svg: (
      <>
        <circle cx={cx} cy={cy} r={r} fill={FILL} {...STROKE} />
        <path d={`M ${cx - r} ${cy} A ${r} ${r * 0.3} 0 0 0 ${cx + r} ${cy}`} {...STROKE} strokeWidth={1.2} fill="none" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r * 0.3} 0 0 1 ${cx + r} ${cy}`} {...DASH} />
        <line x1={cx} y1={cy} x2={cx + r} y2={cy} {...STROKE} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        <Label x={cx + r / 2} y={cy - 8}>
          r = {t("radius")}
        </Label>
      </>
    ),
  };
}

function cone(v: Record<string, number>, t: (p: string) => string): Drawn {
  const squash = 0.32;
  const s = fit(2 * v.radius, v.height + v.radius * squash);
  const rx = v.radius * s;
  const ry = rx * squash;
  const h = v.height * s;
  const cx = W / 2;
  const bottom = (H + h + ry) / 2 - ry;
  const apexY = bottom - h;
  return {
    summary: `cone, radius ${t("radius")}, height ${t("height")}`,
    svg: (
      <>
        <path d={`M ${cx - rx} ${bottom} L ${cx} ${apexY} L ${cx + rx} ${bottom} A ${rx} ${ry} 0 0 1 ${cx - rx} ${bottom}`} fill={FILL} {...STROKE} />
        <path d={`M ${cx - rx} ${bottom} A ${rx} ${ry} 0 0 0 ${cx + rx} ${bottom}`} {...DASH} />
        <line x1={cx} y1={apexY} x2={cx} y2={bottom} {...DASH} />
        <line x1={cx} y1={bottom} x2={cx + rx} y2={bottom} {...STROKE} strokeWidth={1.5} />
        <Label x={cx + rx / 2} y={bottom + ry + 16}>
          r = {t("radius")}
        </Label>
        <Label x={cx + 8} y={(apexY + bottom) / 2} anchor="start">
          {t("height")}
        </Label>
      </>
    ),
  };
}

function box(v: Record<string, number>, t: (p: string) => string): Drawn {
  const kx = 0.5;
  const ky = 0.35;
  const dx = v.depth * kx;
  const dy = v.depth * ky;
  // Room is left on the left for the label of the height.
  const s = fit(v.width + dx + 40 / 3, v.height + dy);
  const ox = (W - (v.width + dx) * s) / 2 + 14;
  const oy = (H - (v.height + dy) * s) / 2 + dy * s;
  const P = (mx: number, my: number): [number, number] => [ox + mx * s, oy + my * s];
  const fl = P(0, v.height);
  const fr = P(v.width, v.height);
  const tl = P(0, 0);
  const tr = P(v.width, 0);
  const btr = P(v.width + dx, -dy);
  const btl = P(dx, -dy);
  const bbr = P(v.width + dx, v.height - dy);
  const bbl = P(dx, v.height - dy);
  const pt = (p: [number, number]) => `${p[0]},${p[1]}`;
  return {
    summary: `box, ${t("width")} by ${t("depth")} by ${t("height")}`,
    svg: (
      <>
        <polygon points={`${pt(tl)} ${pt(tr)} ${pt(fr)} ${pt(fl)}`} fill={FILL} {...STROKE} />
        <polygon points={`${pt(tl)} ${pt(btl)} ${pt(btr)} ${pt(tr)}`} fill={FILL} {...STROKE} />
        <polygon points={`${pt(tr)} ${pt(btr)} ${pt(bbr)} ${pt(fr)}`} fill={FILL} {...STROKE} />
        <polyline points={`${pt(fl)} ${pt(bbl)} ${pt(bbr)}`} {...DASH} />
        <line x1={bbl[0]} y1={bbl[1]} x2={btl[0]} y2={btl[1]} {...DASH} />
        <Label x={(fl[0] + fr[0]) / 2} y={fl[1] + 19}>
          {t("width")}
        </Label>
        <Label x={(fr[0] + bbr[0]) / 2 + 8} y={(fr[1] + bbr[1]) / 2 + 20} anchor="start">
          {t("depth")}
        </Label>
        <Label x={fl[0] - 8} y={(tl[1] + fl[1]) / 2 + 5} anchor="end">
          {t("height")}
        </Label>
      </>
    ),
  };
}

function polygon(v: Record<string, number>, t: (p: string) => string, o: Record<string, number>): Drawn {
  const n = Math.min(12, Math.max(3, Math.round(o.sides ?? 6)));
  const R = 76;
  const cx = W / 2;
  const cy = H / 2;
  // The first corner is lower left so that the bottom side is flat and can carry the label.
  const pts = Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 2 + Math.PI / n + (2 * Math.PI * i) / n;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as [number, number];
  });
  const [p0, p1] = [pts[0], pts[n - 1]];
  return {
    summary: `regular polygon with ${n} sides of ${t("side")}`,
    svg: (
      <>
        <polygon points={pts.map((p) => `${p[0]},${p[1]}`).join(" ")} fill={FILL} {...STROKE} />
        <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        <Label x={(p0[0] + p1[0]) / 2} y={Math.max(p0[1], p1[1]) + 19}>
          side {t("side")} · {n} sides
        </Label>
      </>
    ),
  };
}

function annulus(v: Record<string, number>, t: (p: string) => string): Drawn {
  const R = 74;
  const r = Math.min(Math.max(v.inner_radius / v.outer_radius, 0), 0.98) * R;
  const cx = W / 2;
  const cy = H / 2;
  return {
    summary: `ring, outer radius ${t("outer_radius")}, inner radius ${t("inner_radius")}`,
    svg: (
      <>
        <path
          fillRule="evenodd"
          d={`M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`}
          fill={FILL}
          {...STROKE}
        />
        <line x1={cx} y1={cy} x2={cx + R} y2={cy} {...DASH} />
        <circle cx={cx} cy={cy} r={2.5} fill={INK} />
        <Label x={cx + (R + r) / 2} y={cy - 8}>
          R = {t("outer_radius")}
        </Label>
        <Label x={cx} y={cy + 22}>
          hole r = {t("inner_radius")}
        </Label>
      </>
    ),
  };
}

const DRAWINGS: Record<string, (v: Record<string, number>, t: (param: string) => string, o: Record<string, number>) => Drawn> = {
  circle,
  rectangle,
  triangle,
  cylinder,
  pyramid,
  donut,
  ellipse,
  sphere,
  cone,
  box,
  polygon,
  annulus,
};

// One drawing, from the values the board has right now. It follows them as they change.
export function VisualizationView({ viz, values }: { viz: Visualization; values: VizValues }) {
  const type = vizType(viz.type);
  if (!type) return null;
  if (type.kind === "chart") {
    if (viz.type === "sweep") return <SweepChart viz={viz} values={values} />;
    if (viz.type === "sensitivity") return <SensitivityBars viz={viz} values={values} />;
    if (viz.type === "breakdown") return <BreakdownBar viz={viz} values={values} />;
    if (viz.type === "gauge") return <GaugeChart viz={viz} values={values} />;
    if (viz.type === "bars") return <BarsChart viz={viz} values={values} />;
    if (viz.type === "pie") return <PieChart viz={viz} values={values} />;
    if (viz.type === "heatmap") return <HeatMap viz={viz} values={values} />;
    if (viz.type === "dependency") return <DependencyDiagram viz={viz} values={values} />;
    return null;
  }
  const draw = DRAWINGS[viz.type];
  if (!draw) return null;

  const numbers: Record<string, number> = {};
  for (const param of type.params) {
    const variable = viz.map[param.key];
    const n = variable ? values.number(variable) : undefined;
    if (n === undefined || !(n > 0)) {
      return (
        <p className="text-base text-ink-muted">
          The {type.label.toLowerCase()} is drawn once {param.label.toLowerCase()} has a value above zero.
        </p>
      );
    }
    numbers[param.key] = n;
  }
  const { svg, summary } = draw(numbers, (param) => (viz.map[param] ? values.text(viz.map[param]) : ""), viz.options ?? {});
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Drawing: ${summary}`} className="mx-auto block w-full max-w-sm">
      {svg}
    </svg>
  );
}
