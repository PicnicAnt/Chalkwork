"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";

export type BoardItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  views: number;
  ownerName: string;
  isMine: boolean;
  tags: string[];
  /** Formulas and display names, searched too. */
  keywords: string;
};

// The ways the list can be put in order.
export const SORTS = [
  { id: "name", label: "Name" },
  { id: "changed", label: "Recently changed" },
  { id: "created", label: "Newest" },
  { id: "popular", label: "Most viewed" },
] as const;
export type SortId = (typeof SORTS)[number]["id"];
const sortOf = (text: string | undefined): SortId => SORTS.find((s) => s.id === text)?.id ?? "created";
const compare: Record<SortId, (a: BoardItem, b: BoardItem) => number> = {
  name: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }),
  changed: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  popular: (a, b) => b.views - a.views || b.createdAt.localeCompare(a.createdAt),
};

const escapeForRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matches = (board: BoardItem, words: string[]) => matchesWords(`${board.title}\n${board.description}\n${board.tags.join(" ")}\n${board.keywords}`, words);

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
  initialSort,
}: {
  boards: BoardItem[];
  initialQuery?: string;
  initialMine?: boolean;
  initialSort?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [mine, setMine] = useState(initialMine);
  const [sort, setSort] = useState<SortId>(sortOf(initialSort));
  const words = useMemo(() => wordsOf(query), [query]);
  // "My boards" narrows the list to the signed-in user's own; the search then works within it.
  const pool = useMemo(() => (mine ? boards.filter((b) => b.isMine) : boards), [boards, mine]);
  const shown = useMemo(() => [...(words.length ? pool.filter((b) => matches(b, words)) : pool)].sort(compare[sort]), [pool, words, sort]);

  // Keep the filter and the search in the address, so a refresh or a shared link shows the same list.
  function remember(nextQuery: string, nextMine: boolean, nextSort: SortId) {
    const params = new URLSearchParams();
    if (nextMine) params.set("mine", "1");
    if (nextQuery.trim()) params.set("q", nextQuery);
    if (nextSort !== "created") params.set("sort", nextSort);
    const text = params.toString();
    window.history.replaceState(null, "", text ? `?${text}` : window.location.pathname);
  }

  function update(next: string) {
    setQuery(next);
    remember(next, mine, sort);
  }

  function choose(nextMine: boolean) {
    setMine(nextMine);
    remember(query, nextMine, sort);
  }

  function order(next: SortId) {
    setSort(next);
    remember(query, mine, next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
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
      <label className="flex items-baseline gap-2 text-lg text-ink-muted">
        Sort by
        <select value={sort} onChange={(e) => order(e.target.value as SortId)} className="cursor-pointer bg-transparent text-xl text-ink" aria-label="Sort the boards by">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      </div>

      <div className="flex flex-col gap-1">
        <input
          type="search"
          className="field text-xl"
          placeholder="Search titles, descriptions, tags, formulas and variable names"
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
          No board has all of {words.map((w) => `“${w}”`).join(" and ")} in its title, description, tags or formulas.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {shown.map((board) => (
            <li key={board.id}>
              <Link href={`/c/${board.id}`} className="group flex items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/c/${board.id}/image?v=${encodeURIComponent(board.updatedAt)}`} alt="" loading="lazy" className="h-16 w-20 shrink-0 rounded object-cover" />
                <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-baseline gap-3 text-xl">
                  <span className="group-hover:underline group-hover:decoration-wavy">
                    <Highlighted text={board.title} words={words} />
                  </span>
                </span>
                {board.description && (
                  <span className="line-clamp-2 text-base text-ink-muted">
                    <Highlighted text={around(board.description, words)} words={words} />
                  </span>
                )}
                <span className="text-sm text-ink-faint">
                  {board.tags.length > 0 && <span className="mr-2 text-accent-2">{board.tags.map((t) => `#${t}`).join(" ")}</span>}
                  by {board.ownerName}{board.isMine ? " (you)" : ""}
                  {" · "}
                  {sort === "changed" ? `changed ${new Date(board.updatedAt).toLocaleDateString()}` : new Date(board.createdAt).toLocaleDateString()}
                  {sort === "popular" && ` · ${board.views} ${board.views === 1 ? "view" : "views"}`}
                </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}