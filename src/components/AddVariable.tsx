"use client";

import { useState } from "react";
import { SearchSelect } from "./ui/SearchSelect";

export type VariableKind = "number" | "boolean" | "table" | "collection" | "board";

const KINDS: { kind: VariableKind; label: string; hint: string }[] = [
  { kind: "number", label: "Number", hint: "A value that formulas can use and change." },
  { kind: "boolean", label: "Yes / no", hint: "A tick box: 1 for yes and 0 for no in formulas." },
  { kind: "table", label: "Table", hint: "A list of x and y values that a formula looks up, like tax_rate(income)." },
  { kind: "collection", label: "Collection", hint: "Boards that people using this board add, totalled by variable: parts.weight." },
  { kind: "board", label: "Board", hint: "An existing board used inside this one: its variables become name.variable." },
];

// "Add variable": a name and what it is. A number or yes/no is a new variable for the formulas; a table, a collection
// or a board is a variable of that type and shows in the list like the others.
export function AddVariable({
  boards,
  busy,
  onAdd,
}: {
  boards: { id: string; title: string }[];
  busy: boolean;
  /** Adds it; returns why it can't be added, or null when it was. */
  onAdd: (kind: VariableKind, name: string, boardId?: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VariableKind>("number");
  const [boardId, setBoardId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div>
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Add variable
        </button>
      </div>
    );
  }

  const hint = KINDS.find((k) => k.kind === kind)?.hint;
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
          aria-label="Name of the new variable"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as VariableKind)} className="cursor-pointer bg-transparent text-xl" aria-label="Type of the new variable">
          {KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
        {kind === "board" && (
          <SearchSelect value={boardId} onChange={setBoardId} placeholder="Choose a board…" ariaLabel="Board to use" options={boards.map((b) => ({ value: b.id, label: b.title }))} />
        )}
      </div>
      {hint && <p className="text-base text-ink-muted">{hint}</p>}
      {error && <p className="text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !name || (kind === "board" && !boardId)}
          onClick={() => {
            const problem = onAdd(kind, name, kind === "board" ? boardId : undefined);
            if (problem) {
              setError(problem);
              return;
            }
            setError(null);
            setName("");
            setBoardId("");
            setOpen(false);
          }}
        >
          Add
        </button>
        <button
          type="button"
          className="link text-base"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
