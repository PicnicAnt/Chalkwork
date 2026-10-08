"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteBoard } from "@/app/actions";

// Deleting is permanent, so it takes two steps: the button, then a question to confirm.
export function DeleteBoardButton({ id, title }: { id: string; title: string }) {
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
            setAsking(true);
          }}
          className="link text-lg text-danger"
        >
          Delete
        </button>
        {error && <p className="max-w-xs text-right text-sm text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="sketch-box flex max-w-xs flex-col gap-2 px-3 py-2" role="alertdialog" aria-label={`Delete ${title}?`}>
      <p>
        Delete &ldquo;{title}&rdquo; for good? This can&apos;t be undone.
      </p>
      <div className="flex gap-4">
        <button type="button" disabled={pending} onClick={confirmDelete} className="btn text-danger">
          {pending ? "Deleting…" : "Yes, delete it"}
        </button>
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className="link">
          Keep it
        </button>
      </div>
    </div>
  );
}
