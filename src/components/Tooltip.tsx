"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// A small panel that explains something. It shows on hover with a mouse, on keyboard focus, and on
// tap, so it works on phones too. A second tap, a tap anywhere else or Escape closes it, and
// opening another tooltip closes this one.
//
// `children` is what you point at, shown with a dotted underline; `content` is the panel text.
// Not used on the variable names any more (their descriptions are shown inline), but kept here
// so it can be used wherever a hint is needed.
export function Tooltip({
  content,
  children,
  className = "",
  title,
}: {
  content: ReactNode;
  children: ReactNode;
  /** Extra classes for the thing you point at, such as its text size. */
  className?: string;
  /** A native hover hint for the trigger itself, separate from the panel. */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <span ref={wrapper} className="group relative max-w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-describedby={id}
        aria-expanded={open}
        title={title}
        className={`break-words text-left underline decoration-ink-faint decoration-dotted underline-offset-4 ${className}`}
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`tooltip ${open ? "block" : "hidden"} group-hover:block group-has-[:focus-visible]:block`}
      >
        {content}
      </span>
    </span>
  );
}