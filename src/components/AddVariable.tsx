"use client";

import { useState } from "react";
import { BoardPicker, type BoardChoice } from "./BoardPicker";

export type VariableKind = "number" | "boolean" | "table" | "collection" | "board";

const KINDS: { kind: VariableKind; label: string; hint: string }[] = [
  { kind: "number", label: "Number", hint: "A value that formulas can use and change." },
  { kind: "boolean", label: "Yes / no", hint: "A tick box: 1 for yes and 0 for no in formulas." },
  { kind: "table", label: "Table", hint: "A list of x and y values that a formula looks up, like tax_rate(income)." },
  { kind: "collection", label: "Collection", hint: "Boards that people using this board add, totalled by variable: parts.weight." },
  { kind: "board", label: "Existing board", hint: "Search for a board and click it: it is used inside this one, and its variables become name.variable. You can rename it afterwards." },
];

// "Add variable": a name and what it is. A number or yes/no is a new variable for the formulas; a table, a collection
// or a board is a variable of that type and shows in the list like the others.
export function AddVariable({
  boards,
  busy,
  onAdd,
}: {
  boards: BoardChoice[];
  busy: boolean;
  /** Adds it; returns why it can't be added, or null when it was. A board comes with no name: it is named after the board. */
  onAdd: (kind: VariableKind, name: string, boardId?: string) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<VariableKind>("number");
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
        {kind !== "board" && (
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
        )}
        <select value={kind} onChange={(e) => setKind(e.target.value as VariableKind)} className="cursor-pointer bg-transparent text-xl" aria-label="Type of the new variable">
          {KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {kind === "board" && (
        <BoardPicker
          defaultOpen
          available={boards}
          busy={busy}
          onAdd={(id) => {
            const problem = onAdd("board", "", id);
            if (problem) setError(problem);
            else {
              setError(null);
              setOpen(false);
            }
          }}
        />
      )}
      {hint && <p className="text-base text-ink-muted">{hint}</p>}
      {error && <p className="text-danger">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {kind !== "board" && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !name}
          onClick={() => {
            const problem = onAdd(kind, name);
            if (problem) {
              setError(problem);
              return;
            }
            setError(null);
            setName("");
            setOpen(false);
          }}
        >
          Add
        </button>
        )}
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
