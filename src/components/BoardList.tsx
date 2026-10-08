"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

export type BoardItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  ownerName: string | null;
  isMine: boolean;
};

const escapeForRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The words typed in the search box. A board matches when every word is found in its title or
// description, ignoring case, so "dps exile" finds a board with both anywhere in those two fields.
const wordsOf = (query: string) => query.toLocaleLowerCase().split(/\s+/).filter(Boolean);

const matches = (board: BoardItem, words: string[]) => {
  const haystack = `${board.title}\n${board.description}`.toLocaleLowerCase();
  return words.every((w) => haystack.includes(w));
};

// Text with the searched words picked out in the accent color.
function Highlighted({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.map(escapeForRegExp).join("|")})`, "giu"));
  return (
    <>
      {parts.map((part, i) =>
        // With a capture group, the odd pieces are the matches.
        i % 2 === 1 ? (
          <mark key={i} className="search-hit">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// The part of a long description around the first match, so a hit far into the text is still shown.
function around(text: string, words: string[]): string {
  const lower = text.toLocaleLowerCase();
  const first = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0);
  const at = first.length ? Math.min(...first) : 0;
  if (at <= 90) return text;
  return `…${text.slice(Math.max(0, at - 40))}`;
}

// Every board with a search box that filters as you type. The page it is on sends all the boards
// at once, which is fine for the numbers a test setup has.
export function BoardList({ boards, initialQuery = "" }: { boards: BoardItem[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const words = useMemo(() => wordsOf(query), [query]);
  const shown = useMemo(() => (words.length ? boards.filter((b) => matches(b, words)) : boards), [boards, words]);

  function update(next: string) {
    setQuery(next);
    // Keep the search in the address, so a refresh or a shared link shows the same results.
    window.history.replaceState(null, "", next.trim() ? `?q=${encodeURIComponent(next)}` : window.location.pathname);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <input
          type="search"
          className="field text-xl"
          placeholder="Search titles and descriptions"
          aria-label="Search boards"
          value={query}
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") update("");
          }}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="text-sm text-ink-muted" aria-live="polite">
          {words.length
            ? `${shown.length} of ${boards.length} ${boards.length === 1 ? "board" : "boards"}`
            : `${boards.length} ${boards.length === 1 ? "board" : "boards"}`}
        </span>
      </div>

      {boards.length === 0 ? (
        <p className="text-ink-muted">Nothing has been put on a board yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-ink-muted">
          No board has all of {words.map((w) => `“${w}”`).join(" and ")} in its title or description.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {shown.map((board) => (
            <li key={board.id}>
              <Link href={`/c/${board.id}`} className="group flex flex-col gap-0.5">
                <span className="flex items-baseline gap-3 text-xl">
                  <span className="text-accent">→</span>
                  <span className="group-hover:underline group-hover:decoration-wavy">
                    <Highlighted text={board.title} words={words} />
                  </span>
                </span>
                {board.description && (
                  <span className="line-clamp-2 pl-7 text-base text-ink-muted">
                    <Highlighted text={around(board.description, words)} words={words} />
                  </span>
                )}
                <span className="pl-7 text-sm text-ink-faint">
                  {board.ownerName ? `by ${board.ownerName}${board.isMine ? " (you)" : ""}` : "no owner"}
                  {" · "}
                  {new Date(board.createdAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}