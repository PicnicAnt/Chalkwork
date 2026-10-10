"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";

export type SearchOption = { value: string; label: string };

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
  const matching = useMemo(() => options.filter((o) => matchesWords(o.label, words)), [options, words]);
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
        {chosen ? chosen.label : <span className="text-ink-muted">{placeholder}</span>} <span className="text-ink-muted">▾</span>
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
            {shown.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button type="button" className="w-full truncate px-2 py-1 text-left text-lg hover:bg-[var(--board-edge)]" onClick={() => pick(o.value)}>
                  {o.label}
                </button>
              </li>
            ))}
            {matching.length > shown.length && <li className="px-2 py-1 text-sm text-ink-muted">{matching.length - shown.length} more. Type to narrow the list.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
