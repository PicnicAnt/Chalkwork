import type { Drawn } from "./common";
import { W, H, INK, FILL, STROKE, DASH, Label, fit } from "./common";

// Solid shapes, drawn in a slanted view from the front and a little above.

export function sphere(_v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function cone(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function cylinder(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function box(v: Record<string, number>, t: (p: string) => string): Drawn {
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

export function pyramid(v: Record<string, number>, t: (p: string) => string): Drawn {
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
