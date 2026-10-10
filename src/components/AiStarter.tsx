"use client";

import { useState, useTransition } from "react";
import { draftBoard } from "@/app/actions/ai";
import type { BoardDraft } from "@/lib/board-draft";
import { AI_LIMITS } from "@/lib/ai";
import { BoardEditor } from "./BoardEditor";
import type { BoardChoice } from "./BoardsSection";

// "Describe it": a sentence about what to calculate becomes a draft board in the editor. The draft is only a start;
// it is checked like any board and nothing is saved until the person saves it.
export function AiStarter({ availableBoards }: { availableBoards: BoardChoice[] }) {
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<BoardDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (draft) {
    return (
      <div className="flex flex-col gap-4">
        <p className="sketch-box px-4 py-3 text-ink-muted">
          This is a draft written by an AI helper from “{text.trim()}”. Check the formulas and numbers before you rely on it.
        </p>
        <BoardEditor availableBoards={availableBoards} initial={draft} />
      </div>
    );
  }

  return (
    <form
      className="sketch-box flex flex-col gap-2 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const out = await draftBoard(text);
          if (out.ok) setDraft(out.draft);
          else setError(out.error);
        });
      }}
    >
      <label htmlFor="ai-description" className="text-2xl">
        Describe it
      </label>
      <span className="text-base text-ink-muted">
        Write what you want to calculate in a sentence and get a draft board with formulas, units and notes. It uses an AI model, so it takes a few seconds and is limited to {AI_LIMITS.perHour} uses an hour.
      </span>
      <textarea
        id="ai-description"
        className="field w-full text-xl"
        rows={2}
        maxLength={AI_LIMITS.description}
        placeholder="e.g. how long a road trip takes and what it costs in fuel, from distance, speed and fuel price"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-baseline gap-3">
        <button type="submit" className="btn" disabled={pending || !text.trim()}>
          {pending ? "Drafting…" : "Draft a board"}
        </button>
        {error && <span className="text-danger">{error}</span>}
      </div>
    </form>
  );
}
