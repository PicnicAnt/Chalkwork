import { useRef, useState, type ReactNode } from "react";
import { downloadBlob, fileNameOf, svgToPng } from "@/lib/export";
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

export type FigureAction = { label: string; onClick: () => void };

// A chart or drawing with its title. Next to the title is a small arrow that opens what can be done with the picture:
// save it as an image, and whatever else the chart offers (its data as CSV).
export function Figure({ caption, actions = [], children }: { caption: string; actions?: FigureAction[]; children: ReactNode }) {
  const figure = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <figure ref={figure} className="flex flex-col gap-1">
      <figcaption className="relative flex items-baseline justify-center gap-2 text-center text-lg text-ink-muted">
        <button
          type="button"
          className="link text-lg"
          aria-expanded={open}
          aria-label={`Options for ${caption}`}
          title="Save image and more"
          onClick={() => setOpen((o) => !o)}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          {caption} {open ? "▴" : "▾"}
        </button>
        {open && (
          <span role="menu" className="sketch-box absolute inset-x-0 top-0 z-20 flex flex-col bg-[var(--board)] py-1 text-center">
            <button
              type="button"
              role="menuitem"
              className="px-3 py-1 text-center text-base text-ink hover:bg-[var(--board-edge)]"
              onClick={async () => {
                setOpen(false);
                const svg = figure.current?.querySelector<SVGSVGElement>("svg[role=img]");
                if (!svg) return;
                try {
                  setFailed(false);
                  downloadBlob(`${fileNameOf(caption)}.png`, await svgToPng(svg));
                } catch {
                  setFailed(true);
                }
              }}
            >
              Save image
            </button>
            {actions.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="px-3 py-1 text-center text-base text-ink hover:bg-[var(--board-edge)]"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
            <button type="button" role="menuitem" className="px-3 py-1 text-center text-sm text-ink-muted hover:bg-[var(--board-edge)]" onClick={() => setOpen(false)}>
              Close
            </button>
          </span>
        )}
      </figcaption>
      {failed && <span className="text-center text-sm text-danger">Couldn&apos;t save the image</span>}
      {children}
    </figure>
  );
}
