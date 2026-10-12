"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";

/** `group` puts an option under another one (a preset under its board): shown indented, found by the group's words too. */
export type SearchOption = { value: string; label: string; group?: string };

// A drop-down you can type in: the button shows the choice, and opening it gives a search box over the options. Used
// where the list can be long (boards). Enter picks the first match, Escape closes.
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
}: {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const words = useMemo(() => wordsOf(query), [query]);
  const matching = useMemo(() => options.filter((o) => matchesWords(o.group ? `${o.group} ${o.label}` : o.label, words)), [options, words]);
  const shown = matching.slice(0, 50);
  const chosen = options.find((o) => o.value === value);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={box} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        className="field max-w-full truncate text-left text-lg"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {chosen ? (chosen.group ? `${chosen.group} · ${chosen.label}` : chosen.label) : <span className="text-ink-muted">{placeholder}</span>} <span className="text-ink-muted">▾</span>
      </button>
      {open && (
        <div className="sketch-box absolute left-0 z-30 mt-1 flex w-[min(24rem,86vw)] flex-col gap-2 bg-[var(--board)] p-2 shadow-lg">
          <input
            autoFocus
            type="search"
            className="field text-lg"
            placeholder="Search"
            aria-label={`Search ${ariaLabel}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && shown[0]) {
                e.preventDefault();
                pick(shown[0].value);
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <ul id={listId} role="listbox" className="flex max-h-64 flex-col overflow-y-auto">
            {shown.length === 0 && <li className="px-2 py-1 text-base text-ink-muted">Nothing matches.</li>}
            {shown.map((o, i) => {
              const before = shown[i - 1];
              // A preset whose board isn't just above it is given the board's name as a heading.
              const heading = o.group && !(before && (before.label === o.group || before.group === o.group));
              return (
                <Fragment key={o.value}>
                  {heading && <li className="px-2 pt-1 text-base text-ink-muted">{o.group}</li>}
                  <li role="option" aria-selected={o.value === value}>
                    <button type="button" className={`w-full truncate py-1 pr-2 text-left text-lg hover:bg-[var(--board-edge)] ${o.group ? "pl-6" : "pl-2"}`} onClick={() => pick(o.value)}>
                      {o.label}
                    </button>
                  </li>
                </Fragment>
              );
            })}
            {matching.length > shown.length && <li className="px-2 py-1 text-sm text-ink-muted">{matching.length - shown.length} more. Type to narrow the list.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
