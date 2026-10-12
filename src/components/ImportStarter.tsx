"use client";

import { useRef, useState, useTransition } from "react";
import { importBoardFile } from "@/app/actions/boards";
import type { BoardDraft } from "@/lib/board-draft";
import { BoardEditor } from "./BoardEditor";
import type { BoardChoice } from "./BoardsSection";

// "Import a board file": a file from "Download board file" becomes a draft in the editor. Nothing is saved until the
// person saves it.
export function ImportStarter({ availableBoards }: { availableBoards: BoardChoice[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ draft: BoardDraft; note: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (draft) {
    return (
      <div className="flex flex-col gap-4">
        <p className="sketch-box px-4 py-3 text-ink-muted">
          Imported from {draft.name}. {draft.note} Check it and save it to keep it.
        </p>
        <BoardEditor availableBoards={availableBoards} initial={draft.draft} />
      </div>
    );
  }

  return (
    <div className="sketch-box flex flex-col gap-2 px-4 py-3">
      <span className="text-2xl">Import a board file</span>
      <span className="text-base text-ink-muted">Open a board file you downloaded from a board (Share → Download board file), here or on another Chalkwork.</span>
      <div className="flex flex-wrap items-baseline gap-3">
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="text-base"
          aria-label="Board file"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError(null);
            start(async () => {
              const text = await file.text();
              const out = await importBoardFile(text);
              if (out.ok) setDraft({ draft: out.draft, note: out.note, name: file.name });
              else setError(out.error);
            });
          }}
        />
        {pending && <span className="text-ink-muted">Reading…</span>}
        {error && <span className="text-danger">{error}</span>}
      </div>
    </div>
  );
}
