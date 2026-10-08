"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveSuggestion, rejectSuggestion, withdrawSuggestion, type DecisionResult } from "@/app/actions";

// The owner approves or rejects an open suggestion; the person who made it can withdraw it.
export function ReviewActions({ id, role }: { id: string; role: "owner" | "author" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [changedSince, setChangedSince] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  function run(action: () => Promise<DecisionResult>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(result.error);
      setChangedSince(result.changedSince === true);
    });
  }

  if (role === "author") {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => withdrawSuggestion(id))} className="link self-start text-lg">
          Withdraw this suggestion
        </button>
        {error && <p className="text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => approveSuggestion(id, changedSince))}
          className="btn btn-primary"
        >
          {changedSince ? "Approve anyway" : "Approve"}
        </button>
        <button type="button" disabled={pending} onClick={() => setRejecting((r) => !r)} className="btn">
          Reject
        </button>
      </div>
      {rejecting && (
        <div className="flex flex-col gap-2">
          <textarea
            className="field resize-none"
            rows={2}
            maxLength={500}
            placeholder="Why? (optional, shown to the person who suggested it)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Reason for rejecting"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rejectSuggestion(id, note))}
            className="btn self-start text-danger"
          >
            {pending ? "Rejecting…" : "Reject this suggestion"}
          </button>
        </div>
      )}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
