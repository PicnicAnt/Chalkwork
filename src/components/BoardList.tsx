"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";

export type BoardItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  ownerName: string | null;
  isMine: boolean;
};

const escapeForRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matches = (board: BoardItem, words: string[]) => matchesWords(`${board.title}\n${board.description}`, words);

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
export function BoardList({
  boards,
  initialQuery = "",
  initialMine = false,
}: {
  boards: BoardItem[];
  initialQuery?: string;
  initialMine?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [mine, setMine] = useState(initialMine);
  const words = useMemo(() => wordsOf(query), [query]);
  // "My boards" narrows the list to the signed-in user's own; the search then works within it.
  const pool = useMemo(() => (mine ? boards.filter((b) => b.isMine) : boards), [boards, mine]);
  const shown = useMemo(() => (words.length ? pool.filter((b) => matches(b, words)) : pool), [pool, words]);

  // Keep the filter and the search in the address, so a refresh or a shared link shows the same list.
  function remember(nextQuery: string, nextMine: boolean) {
    const params = new URLSearchParams();
    if (nextMine) params.set("mine", "1");
    if (nextQuery.trim()) params.set("q", nextQuery);
    const text = params.toString();
    window.history.replaceState(null, "", text ? `?${text}` : window.location.pathname);
  }

  function update(next: string) {
    setQuery(next);
    remember(next, mine);
  }

  function choose(nextMine: boolean) {
    setMine(nextMine);
    remember(query, nextMine);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3" role="group" aria-label="Which boards">
        {[
          { label: "All boards", value: false },
          { label: "My boards", value: true },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={mine === option.value}
            className={`btn ${mine === option.value ? "btn-primary" : "text-ink-muted"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

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
            ? `${shown.length} of ${pool.length} ${pool.length === 1 ? "board" : "boards"}`
            : `${pool.length} ${pool.length === 1 ? "board" : "boards"}`}
        </span>
      </div>

      {pool.length === 0 ? (
        mine ? (
          <p className="text-ink-muted">
            You haven&apos;t made a board yet.{" "}
            <Link href="/new" className="link">
              Start one
            </Link>
          </p>
        ) : (
          <p className="text-ink-muted">Nothing has been put on a board yet.</p>
        )
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