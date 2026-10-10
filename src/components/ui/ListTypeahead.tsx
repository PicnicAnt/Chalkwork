"use client";

import { useId, useMemo, useState } from "react";

// A text field for a list of names separated by commas, which offers the names that fit what is being typed (like
// the names offered while writing a formula). Click a name, or press Enter or Tab, to take the first.
export function ListTypeahead({
  value,
  onChange,
  suggestions,
  placeholder,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const listId = useId();

  // The word being typed is what comes after the last comma; names already in the list aren't offered again.
  const { head, word, items } = useMemo(() => {
    const cut = value.lastIndexOf(",");
    const head = cut < 0 ? "" : value.slice(0, cut + 1);
    const word = value.slice(cut + 1).trim().toLocaleLowerCase();
    const used = new Set(head.split(/[\s,;]+/).filter(Boolean));
    const items = suggestions
      .filter((s) => !used.has(s) && s.toLocaleLowerCase().includes(word) && s.toLocaleLowerCase() !== word)
      .sort((a, b) => Number(b.toLocaleLowerCase().startsWith(word)) - Number(a.toLocaleLowerCase().startsWith(word)))
      .slice(0, 6);
    return { head, word, items };
  }, [value, suggestions]);

  const take = (name: string) => {
    onChange(`${head}${head && !head.endsWith(" ") ? " " : ""}${name}, `);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        className="field w-full text-xl"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-controls={listId}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === "Tab") && focused && items.length > 0 && word) {
            e.preventDefault();
            take(items[0]);
          }
        }}
      />
      {focused && items.length > 0 && (
        <ul id={listId} role="listbox" className="suggest absolute left-0 z-30 mt-1 flex max-w-full flex-col py-1 text-lg">
          {items.map((name) => (
            <li key={name} role="option" aria-selected={false}>
              <button type="button" className="suggest-item w-full px-3 text-left" onMouseDown={(e) => e.preventDefault()} onClick={() => take(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
