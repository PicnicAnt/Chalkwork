"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBoard } from "@/app/actions";

// Deleting is permanent, so it takes two steps: the button, then a question to confirm.
export function DeleteBoardButton({ id, title, canDelete }: { id: string; title: string; canDelete: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirmDelete() {
    setError(null);
    start(async () => {
      const result = await deleteBoard(id);
      if (result.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(result.error);
        setAsking(false);
      }
    });
  }

  if (!asking) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => {
            setError(null);
            // Everyone sees the button; only the owner gets as far as the question.
            if (canDelete) setAsking(true);
            else setError("Only the owner can delete this board.");
          }}
          className={`link text-lg text-danger ${canDelete ? "" : "opacity-60"}`}
        >
          Delete
        </button>
        {error && <p className="max-w-[min(20rem,calc(100vw-4rem))] text-right text-sm text-danger">{error}</p>}
      </div>
    );
  }
  // The question is a dialog over the page, so it fits any screen width instead of hanging off the
  // edge of the header it was opened from.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        className="sketch-box flex w-full max-w-sm flex-col gap-3 bg-[var(--board)] px-5 py-4"
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete ${title}?`}
      >
        <p className="text-xl">
          Delete &ldquo;{title}&rdquo; for good? This can&apos;t be undone.
        </p>
        <div className="flex flex-wrap gap-4">
          <button type="button" disabled={pending} onClick={confirmDelete} className="btn text-danger">
            {pending ? "Deleting…" : "Yes, delete it"}
          </button>
          <button type="button" disabled={pending} onClick={() => setAsking(false)} className="link">
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}
