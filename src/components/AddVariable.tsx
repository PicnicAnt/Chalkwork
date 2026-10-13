"use client";

import { useMemo, useState } from "react";
import { matchesWords, wordsOf } from "@/lib/board-search";
import type { BoardChoice } from "./BoardPicker";
import { SearchSelect } from "./ui/SearchSelect";

export type VariableKind = "number" | "boolean" | "table" | "collection" | "board";

const KINDS: { kind: "number" | "boolean" | "table"; label: string; hint: string }[] = [
  { kind: "number", label: "Number", hint: "A value that formulas can use and change." },
  { kind: "boolean", label: "Yes / no", hint: "A tick box: 1 for yes and 0 for no in formulas." },
  { kind: "table", label: "Table", hint: "A list of x and y values that a formula looks up, like tax_rate(income)." },
];

// The three ways to add to a board's variables. "Add variable" asks for a name and a kind of value; "Add board" is a
// searchable list of boards, and picking one adds it (its variables become name.variable, and it can be renamed
// afterwards); "Add collection" asks for a name and which boards may be added to it, as a searchable list with tick
// boxes.
export function AddVariable({
  boards,
  busy,
  onAdd,
}: {
  boards: BoardChoice[];
  busy: boolean;
  /** Adds it; returns why it can't be added, or null when it was. A board comes with no name: it is named after the board. */
  onAdd: (kind: VariableKind, name: string, boardId?: string, allowed?: string[], preset?: string) => string | null;
}) {
  const [form, setForm] = useState<"variable" | "collection" | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"number" | "boolean" | "table">("number");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const words = useMemo(() => wordsOf(query), [query]);
  const shown = useMemo(() => boards.filter((b) => matchesWords(b.title, words)).slice(0, 100), [boards, words]);

  const close = () => {
    setForm(null);
    setError(null);
    setName("");
    setAllowed([]);
    setQuery("");
  };

  if (form === null) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <button type="button" className="btn" onClick={() => { setKind("number"); setForm("variable"); }}>
            Add variable
          </button>
          {boards.length > 0 && (
          <SearchSelect
            value=""
            onChange={(v) => {
              // A preset is "board id@preset": it adds the board starting from that preset.
              const at = v.indexOf("@");
              setError(at < 0 ? onAdd("board", "", v) : onAdd("board", "", v.slice(0, at), undefined, v.slice(at + 1)));
            }}
            placeholder="Add board"
            trigger="Add board"
            ariaLabel="Add board"
            options={boards.flatMap((b) => [
              { value: b.id, label: b.title },
              ...(b.presets ?? []).map((p) => ({ value: `${b.id}@${p}`, label: p, group: b.title })),
            ])}
          />
          )}
          <button type="button" className="btn" onClick={() => setForm("collection")}>
            Add collection
          </button>
        </div>
        {error && <p className="text-danger">{error}</p>}
      </div>
    );
  }

  const hint = form === "variable" ? KINDS.find((k) => k.kind === kind)?.hint : "People using the board add boards to it, and formulas use what they add up to: parts.weight, avg(parts.weight). Choose which boards can be added, or none to allow any.";
  return (
    <div className="sketch-box flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <input
          autoFocus
          className="field w-48 text-xl"
          value={name}
          placeholder="name"
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={form === "collection" ? "Name of the new collection" : "Name of the new variable"}
        />
        {form === "variable" ? (
          <select value={kind} onChange={(e) => setKind(e.target.value as "number" | "boolean" | "table")} className="cursor-pointer bg-transparent text-xl" aria-label="Type of the new variable">
            {KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xl text-ink-muted">collection</span>
        )}
      </div>
      {form === "collection" && boards.length > 0 && (
        <div className="flex flex-col gap-2">
          {boards.length > 5 && (
            <input type="search" className="field text-lg" placeholder="Search boards" aria-label="Search the boards that can be added" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
          )}
          <ul className="flex max-h-56 flex-col overflow-y-auto" aria-label="Boards that can be added to the collection">
            {shown.length === 0 && <li className="px-2 py-1 text-base text-ink-muted">Nothing matches.</li>}
            {shown.map((b) => (
              <li key={b.id}>
                <label className="flex cursor-pointer items-center gap-3 px-2 py-1 text-lg hover:bg-[var(--board-edge)]">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--accent)]"
                    checked={allowed.includes(b.id)}
                    onChange={(e) => setAllowed((list) => (e.target.checked ? [...list, b.id] : list.filter((x) => x !== b.id)))}
                  />
                  <span className="min-w-0 truncate">{b.title}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-base text-ink-muted">{allowed.length === 0 ? "Any board can be added." : `${allowed.length} board${allowed.length === 1 ? "" : "s"} can be added.`}</p>
        </div>
      )}
      {hint && <p className="text-base text-ink-muted">{hint}</p>}
      {error && <p className="text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !name}
          onClick={() => {
            const problem = onAdd(form === "collection" ? "collection" : kind, name, undefined, form === "collection" ? allowed : undefined);
            if (problem) {
              setError(problem);
              return;
            }
            close();
          }}
        >
          Add
        </button>
        <button type="button" className="link text-base" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}
