"use client";

import { useId, useState, type ReactNode } from "react";
import { Chevron } from "./Chevron";

// A section of the editor that is folded away until it is asked for. The body stays mounted while it is
// folded, so a half-typed field isn't lost. The description comes first in the body; a list of foldable
// rows below it puts its "Expand all / Collapse all" bar (see ExpandAllBar) above the rows.
export function CollapsibleSection({
  title,
  count,
  description,
  children,
}: {
  title: string;
  /** Shown after the title, for sections that are lists. */
  count?: number;
  description?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">
          {title}
          {count !== undefined && <span className="text-lg font-normal text-ink-muted"> ({count})</span>}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          title={open ? "Collapse" : "Expand"}
          className="shrink-0 p-1 text-accent"
        >
          <Chevron open={open} />
        </button>
      </div>
      <div id={bodyId} className={open ? "flex flex-col gap-4" : "hidden"}>
        {description && <p className="text-base text-ink-muted">{description}</p>}
        {children}
      </div>
    </section>
  );
}
