"use client";

import { useState, useTransition } from "react";
import { explainBoard } from "@/app/actions/ai";

// "Explain this board": a short plain-language account of what the board does, written by an AI model on request.
export function ExplainBoard({ boardId }: { boardId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <button
          type="button"
          className="link text-base"
          disabled={pending}
          title="An AI model reads the formulas and explains the board. Uses a few seconds, and is limited per hour."
          onClick={() =>
            start(async () => {
              setError(null);
              const out = await explainBoard(boardId);
              if (out.ok) setText(out.text);
              else setError(out.error);
            })
          }
        >
          {pending ? "Reading the board…" : text ? "Explain again" : "Explain this board"}
        </button>
        {error && <span className="text-danger">{error}</span>}
      </div>
      {text && (
        <p className="sketch-box whitespace-pre-line px-4 py-3 text-lg">
          {text}
          <span className="mt-1 block text-sm text-ink-faint">Written by an AI helper; it can be wrong.</span>
        </p>
      )}
    </div>
  );
}
