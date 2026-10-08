import type { Drawn } from "./common";
import { W, H, INK, FILL, STROKE, DASH, Label, fit } from "./common";

// Shapes that lie flat: seen from above or straight on.

export function circle(_v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function rectangle(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function triangle(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function ellipse(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function polygon(_v: Record<string, number>, t: (p: string) => string, o: Record<string, number>): Drawn {
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

export function annulus(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function donut(v: Record<string, number>, t: (p: string) => string): Drawn {
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
