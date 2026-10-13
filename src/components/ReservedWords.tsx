"use client";

import { useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";
import { CONSTANT_WORDS, FUNCTION_WORDS, otherReservedNames } from "@/lib/reserved-words";

// The words a formula can use that are not variables, with what each does, so a name that is refused can be understood.
export function ReservedWords() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const words = useMemo(() => wordsOf(query), [query]);
  const others = useMemo(() => (open ? otherReservedNames() : []), [open]);
  const fits = (w: { name: string; use: string; text: string }) => matchesWords(`${w.name} ${w.use} ${w.text}`, words);
  const constants = CONSTANT_WORDS.filter(fits);
  const functions = FUNCTION_WORDS.filter(fits);
  const rest = others.filter((n) => matchesWords(n, words));

  const table = (title: string, list: typeof CONSTANT_WORDS) =>
    list.length > 0 && (
      <div className="flex flex-col gap-1">
        <h3 className="text-lg text-ink-muted">{title}</h3>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {list.map((w) => (
            <div key={w.name} className="contents">
              <dt className="text-lg text-accent-2">{w.use}</dt>
              <dd className="mb-1 text-base text-ink-muted sm:mb-0">{w.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="link self-start text-base" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide the reserved words" : "Reserved words and functions"}
      </button>
      {open && (
        <div className="fold-box flex flex-col gap-3">
          <p className="text-base text-ink-muted">
            These names belong to the maths, so a variable can&apos;t be called one of them. In a collection, sum(), avg(), min(), max() and
            count() work over its boards.
          </p>
          <input type="search" className="field text-lg" placeholder="Search" aria-label="Search the reserved words" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          {table("Constants", constants)}
          {table("Functions", functions)}
          {rest.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 className="text-lg text-ink-muted">Other built-in names</h3>
              <p className="break-words text-base text-ink-muted">{rest.join(", ")}</p>
            </div>
          )}
          {constants.length + functions.length + rest.length === 0 && <p className="text-base text-ink-muted">Nothing matches.</p>}
        </div>
      )}
    </div>
  );
}
