"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { findBoards, type JumpBoard } from "@/app/actions/search";
import { matchesWords, wordsOf } from "@/lib/board-search";

type Variable = { id: string; label: string };

// Ctrl+K (or the "Jump to" button): a search box over the board that is open (its variables) and over every board.
// Picking a variable scrolls to it and puts the cursor in it; picking a board opens it.
export function QuickJump() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [boards, setBoards] = useState<JumpBoard[]>([]);
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // The variables on the page are read from its fields when the box opens.
  useEffect(() => {
    if (!open) return;
    const found = [...document.querySelectorAll<HTMLInputElement>('input[id^="var-"]')].map((el) => ({
      id: el.id,
      label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || el.id.slice(4),
    }));
    // Setting state here is the point: the list reflects the page as it is when the box is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVariables(found);
  }, [open]);

  // The boards that fit, asked for a moment after typing stops.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const wait = setTimeout(() => {
      findBoards(query).then((list) => {
        if (!cancelled) setBoards(list);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(wait);
    };
  }, [open, query]);

  const words = useMemo(() => wordsOf(query), [query]);
  const matchingVariables = useMemo(() => variables.filter((v) => matchesWords(v.label, words)).slice(0, 8), [variables, words]);
  const rows = useMemo(
    () => [
      ...matchingVariables.map((v) => ({ key: `v:${v.id}`, kind: "variable" as const, label: v.label, id: v.id, note: "" })),
      ...boards.map((b) => ({ key: `b:${b.id}`, kind: "board" as const, label: b.title, id: b.id, note: b.description })),
    ],
    [matchingVariables, boards],
  );

  function close() {
    setOpen(false);
    setQuery("");
    setAt(0);
  }

  function choose(row: (typeof rows)[number]) {
    close();
    if (row.kind === "board") {
      router.push(`/c/${row.id}`);
      return;
    }
    const el = document.getElementById(row.id);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    el?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  return (
    <>
      <button type="button" className="link text-lg" onClick={() => setOpen(true)} title="Jump to a board or a variable (Ctrl+K)">
        Jump to…
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div role="dialog" aria-label="Jump to" className="sketch-box flex w-full max-w-lg flex-col gap-2 bg-[var(--board)] p-3 shadow-lg">
            <input
              ref={input}
              className="field text-xl"
              placeholder="A board or a variable on this page"
              aria-label="Jump to"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAt(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setAt((a) => Math.min(a + 1, rows.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setAt((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && rows[at]) {
                  e.preventDefault();
                  choose(rows[at]);
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <ul className="flex max-h-[50vh] flex-col overflow-y-auto" role="listbox">
              {rows.length === 0 && <li className="px-2 py-1 text-base text-ink-muted">Nothing matches.</li>}
              {rows.map((row, i) => (
                <li key={row.key} role="option" aria-selected={i === at}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0 px-2 py-1.5 text-left hover:bg-[var(--board-edge)] ${i === at ? "bg-[var(--board-edge)]" : ""}`}
                    onMouseEnter={() => setAt(i)}
                    onClick={() => choose(row)}
                  >
                    <span className="flex items-baseline gap-3 text-lg">
                      <span className="shrink-0 text-sm text-ink-faint">{row.kind === "variable" ? "variable" : "board"}</span>
                      <span className="min-w-0 break-words">{row.label}</span>
                    </span>
                    {row.note && <span className="line-clamp-1 text-sm text-ink-muted">{row.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
