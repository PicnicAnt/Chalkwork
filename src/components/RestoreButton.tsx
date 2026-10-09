"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreVersion } from "@/app/actions/versions";

// Puts the board back to an earlier version, after asking. The restore is saved as a new version, so it can be undone.
export function RestoreButton({ boardId, version }: { boardId: string; version: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!asking) {
    return (
      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={() => setAsking(true)} className="link text-base">
          Restore this version
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-base">
      <span>Make the board what it was in version {version}? (It is kept as a new version.)</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await restoreVersion(boardId, version);
            setAsking(false);
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        className="link"
      >
        {pending ? "Restoring…" : "Yes, restore"}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className="link text-ink-muted">
        Cancel
      </button>
    </div>
  );
}
