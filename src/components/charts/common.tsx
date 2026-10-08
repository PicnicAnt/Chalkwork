import type { ReactNode } from "react";
import type { VizValues } from "../viz-values";

// Shared by the charts: the picture's width, the colours, and the small pieces every chart is made of.
export const W = 360;
export const INK = "var(--ink)";
export const MUTED = "var(--ink-muted)";
export const FAINT = "var(--ink-faint)";
export const FONT = "var(--font-hand), cursive";
export const PALETTE = ["var(--accent)", "var(--accent-2)", "var(--op)", "var(--note)", "var(--danger)"];

export function Text({ x, y, anchor = "middle", size = 14, fill = INK, children }: { x: number; y: number; anchor?: "start" | "middle" | "end"; size?: number; fill?: string; children: ReactNode }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} style={{ fontFamily: FONT }}>
      {children}
    </text>
  );
}

// A number written briefly: four significant digits, thousands separated.
export const short = (n: number) => n.toLocaleString("en-US", { maximumSignificantDigits: 4 });
export const withUnit = (v: VizValues, name: string) => (v.unit(name) ? `${v.name(name)} (${v.unit(name)})` : v.name(name));
export const finite = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-base text-ink-muted">{children}</p>;
}

export function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-center text-lg text-ink-muted">{caption}</figcaption>
      {children}
    </figure>
  );
}
