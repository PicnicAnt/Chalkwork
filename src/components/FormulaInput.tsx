"use client";

import { useMemo } from "react";
import { tokenize, type TokenKind } from "@/lib/formulas";

// A textarea with syntax colors. The colored copy of the text sits underneath in a <pre> that
// sets the size of the box, and the real textarea is laid over it with transparent text, so
// typing, selecting and the caret all stay native.
export function FormulaInput({
  value,
  onChange,
  placeholder,
  badLines,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Zero-based line numbers of the text to underline as errors. */
  badLines?: ReadonlySet<number>;
}) {
  // Each token also knows which line of the text it is on.
  const tokens = useMemo(
    () =>
      tokenize(value).reduce<{ kind: TokenKind; text: string; line: number }[]>((all, t) => {
        const previous = all[all.length - 1];
        const line = previous ? previous.line + previous.text.split("\n").length - 1 : 0;
        all.push({ ...t, line });
        return all;
      }, []),
    [value],
  );

  return (
    <div className="sketch-box grid min-h-40 w-full focus-within:!border-accent">
      <pre
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1 m-0 whitespace-pre-wrap break-words px-4 py-3 font-[inherit] text-xl leading-9"
      >
        {tokens.map((t, i) => (
          <span key={i} className={`tok-${t.kind}${t.kind !== "text" && badLines?.has(t.line) ? " tok-error" : ""}`}>
            {t.text}
          </span>
        ))}
        {/* A final newline has no width, so give it something to size the last line. */}
        {"\n "}
      </pre>
      <textarea
        className="formula-textarea col-start-1 row-start-1 m-0 w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent px-4 py-3 text-xl leading-9 text-transparent outline-none placeholder:text-ink-faint"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={1}
        aria-label="Formulas"
      />
    </div>
  );
}
