"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { tokenize, type TokenKind } from "@/lib/formulas";
import { suggest, type Suggestion } from "@/lib/suggestions";

// A textarea with syntax colors and typeahead. The colored copy of the text sits underneath in a
// <pre> that sets the size of the box, and the real textarea is laid over it with transparent
// text, so typing, selecting and the caret all stay native. The suggestion list is placed by an
// invisible marker the <pre> draws at the caret, so it needs no measuring.
export function FormulaInput({
  value,
  onChange,
  placeholder,
  badLines,
  extraNames,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Zero-based line numbers of the text to underline as errors. */
  badLines?: ReadonlySet<number>;
  /** More names to suggest, such as the variables of boards in use (board.variable). */
  extraNames?: readonly string[];
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  // Set when a suggestion is accepted; applied once the new text has rendered.
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  // Which suggestion is highlighted, and whether the user moved it (Enter only accepts then).
  const [nav, setNav] = useState({ word: "", index: 0, moved: false });
  // Escape hides the list until the word being typed changes.
  const [dismissed, setDismissed] = useState<{ start: number; word: string } | null>(null);

  const list = useMemo(() => (caret === null ? null : suggest(value, caret, extraNames)), [value, caret, extraNames]);
  const open = list !== null && !(dismissed && dismissed.start === list.start && dismissed.word === list.word);
  const index = open && nav.word === list.word ? Math.min(nav.index, list.items.length - 1) : 0;
  const moved = open && nav.word === list.word && nav.moved;

  useLayoutEffect(() => {
    if (pendingCaret === null || !textarea.current) return;
    textarea.current.setSelectionRange(pendingCaret, pendingCaret);
    setPendingCaret(null);
  }, [pendingCaret, value]);

  // Each token also knows where it starts and which line of the text it is on.
  const tokens = useMemo(
    () =>
      tokenize(value).reduce<{ kind: TokenKind; text: string; line: number; start: number }[]>((all, t) => {
        const previous = all[all.length - 1];
        const line = previous ? previous.line + previous.text.split("\n").length - 1 : 0;
        const start = previous ? previous.start + previous.text.length : 0;
        all.push({ ...t, line, start });
        return all;
      }, []),
    [value],
  );

  function accept(item: Suggestion) {
    if (!list) return;
    // Functions get their opening bracket, ready for the arguments.
    const insert = item.kind === "function" ? `${item.text}(` : item.text;
    onChange(value.slice(0, list.start) + insert + value.slice(list.end));
    setPendingCaret(list.start + insert.length);
    setCaret(list.start + insert.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || !list) return;
    const count = list.items.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : count - 1;
      setNav({ word: list.word, index: (index + step) % count, moved: true });
    } else if (e.key === "Tab" || (e.key === "Enter" && moved)) {
      e.preventDefault();
      accept(list.items[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissed({ start: list.start, word: list.word });
    }
  }

  const bad = (t: { kind: TokenKind; line: number }) => t.kind !== "text" && badLines?.has(t.line);
  const span = (t: { kind: TokenKind; line: number }, text: string, key: string) => (
    <span key={key} aria-hidden className={`tok-${t.kind}${bad(t) ? " tok-error" : ""}`}>
      {text}
    </span>
  );

  // While the list is open, the token the caret is in is split so the marker can sit at the caret.
  const rendered = tokens.map((t, i) => {
    const here = open && caret !== null && t.start < caret && caret <= t.start + t.text.length;
    if (!here || caret === null) return span(t, t.text, String(i));
    const cut = caret - t.start;
    return (
      <Fragment key={i}>
        {span(t, t.text.slice(0, cut), `${i}a`)}
        <SuggestionList items={list.items} index={index} onPick={accept} />
        {span(t, t.text.slice(cut), `${i}b`)}
      </Fragment>
    );
  });

  return (
    <div className="sketch-box relative grid min-h-40 w-full focus-within:!border-accent">
      <pre className="pointer-events-none col-start-1 row-start-1 m-0 whitespace-pre-wrap break-words px-4 py-3 font-[inherit] text-xl leading-9">
        {rendered}
        {/* A final newline has no width, so give it something to size the last line. */}
        <span aria-hidden>{"\n "}</span>
      </pre>
      <textarea
        ref={textarea}
        className="formula-textarea col-start-1 row-start-1 m-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent px-4 py-3 text-xl leading-9 text-transparent outline-none placeholder:text-ink-faint"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart === e.target.selectionEnd ? e.target.selectionStart : null);
        }}
        onSelect={(e) => {
          const t = e.currentTarget;
          setCaret(t.selectionStart === t.selectionEnd ? t.selectionStart : null);
        }}
        onBlur={() => setCaret(null)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={1}
        aria-label="Formulas"
        aria-autocomplete="list"
      />
    </div>
  );
}

const KIND_LABEL: Record<Suggestion["kind"], string> = { variable: "variable", function: "function", constant: "constant" };

// An invisible marker at the caret that carries the list. The list itself is positioned from the
// marker's line (top is left automatic) and from the box's left edge.
function SuggestionList({
  items,
  index,
  onPick,
}: {
  items: Suggestion[];
  index: number;
  onPick: (item: Suggestion) => void;
}) {
  return (
    <span className="inline-block h-9 w-0 align-top">
      <ul
        role="listbox"
        className="suggest pointer-events-auto absolute left-4 z-30 mt-9 flex max-w-[calc(100%-2rem)] flex-col py-1 text-lg leading-7"
      >
        {items.map((item, i) => (
          <li
            key={item.text}
            role="option"
            aria-selected={i === index}
            // Keep focus in the text box when picking with a finger or the mouse.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={`suggest-item flex cursor-pointer items-baseline gap-3 px-3 ${i === index ? "suggest-active" : ""}`}
          >
            <span className={`tok-${item.kind === "variable" ? "variable" : "reserved"}`}>{item.text}</span>
            <span className="ml-auto truncate text-sm text-ink-muted">{item.hint || KIND_LABEL[item.kind]}</span>
          </li>
        ))}
      </ul>
    </span>
  );
}
