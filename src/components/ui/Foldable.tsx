"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Chevron } from "./Chevron";

// One row of a list that can be folded: a header line that says what it is, and fields underneath that
// show when it is unfolded. The fields stay mounted while folded, so a half-typed name isn't lost.
export function Foldable({
  summary,
  hint,
  actions,
  expanded,
  onToggle,
  children,
}: {
  summary: ReactNode;
  /** Quiet words after the summary, such as the unit or "hidden". */
  hint?: ReactNode;
  /** Small controls at the end of the header line, outside the button that folds the row. */
  actions?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fold-box flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-baseline justify-between gap-3 text-left text-xl"
      >
        <span className="min-w-0 truncate">
          {summary}
          {hint && <span className="text-base text-ink-muted">{hint}</span>}
        </span>
        <span className="shrink-0 text-accent" title={expanded ? "Collapse" : "Expand"}>
          <Chevron open={expanded} />
        </span>
      </button>
      {actions}
      </div>
      <div className={expanded ? "flex flex-col gap-1" : "hidden"}>{children}</div>
    </div>
  );
}

// Which rows of a list are unfolded. Everything starts folded.
export function useFold() {
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});
  return {
    isOpen: (key: string) => unfolded[key] === true,
    toggle: useCallback((key: string) => setUnfolded((u) => ({ ...u, [key]: !u[key] })), []),
    open: useCallback((key: string) => setUnfolded((u) => ({ ...u, [key]: true })), []),
    expandAll: useCallback((keys: string[]) => setUnfolded(Object.fromEntries(keys.map((k) => [k, true]))), []),
    collapseAll: useCallback(() => setUnfolded({}), []),
  };
}

// "Expand all / Collapse all" for a list of foldable rows. It sits under the section's description and
// above the rows.
export function ExpandAllBar({ onExpandAll, onCollapseAll }: { onExpandAll: () => void; onCollapseAll: () => void }) {
  return (
    <div className="flex items-baseline gap-4">
      <button type="button" onClick={onExpandAll} className="link text-base">
        Expand all
      </button>
      <button type="button" onClick={onCollapseAll} className="link text-base">
        Collapse all
      </button>
    </div>
  );
}
