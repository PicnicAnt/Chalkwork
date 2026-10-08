import type { ReactNode } from "react";

// What every shape is drawn with: the size of the picture, the pen, and the label. Shapes keep their
// proportions (a tall rectangle is drawn tall) and are scaled to fit the picture.
// A shape is a function from the numbers of its parameters to SVG, plus a sentence for screen readers;
// the board only says which variable feeds which parameter (see lib/visualizations.ts).

export const W = 320;
export const H = 210;
export const PAD = 30;


export const INK = "var(--ink)";
export const MUTED = "var(--ink-muted)";
export const FILL = "color-mix(in srgb, var(--accent) 14%, transparent)";
export const STROKE = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
export const DASH = { stroke: MUTED, strokeWidth: 1.5, strokeDasharray: "5 4", fill: "none" };

export function Label({ x, y, anchor = "middle", children }: { x: number; y: number; anchor?: "start" | "middle" | "end"; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fill={INK} fontSize={15} style={{ fontFamily: "var(--font-hand), cursive" }}>
      {children}
    </text>
  );
}

// A scale that makes a drawing of the given size fit inside the picture.
export const fit = (width: number, height: number) => Math.min((W - 2 * PAD) / width, (H - 2 * PAD) / height);

export type Drawn = { svg: ReactNode; summary: string };
