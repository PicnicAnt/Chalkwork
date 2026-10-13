"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createBoard } from "@/app/actions/boards";
import { flatten, type OwnData } from "@/lib/boards";
import { humanize } from "@/lib/formulas";
import { removeLocalBoard } from "@/lib/local-boards";
import { SharedCalculator } from "./SharedCalculator";
import { useLocalBoards } from "./useLocalBoards";

// A board kept on this device, shown the way a saved board is, without the parts that need the server (sharing,
// scenarios, other boards). Signed in, it can be saved to the account.
export function LocalBoardView({ id, signedIn }: { id: string; signedIn: boolean }) {
  const router = useRouter();
  const { boards, ready } = useLocalBoards();
  const board = boards.find((b) => b.id === id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const flat = useMemo(() => (board ? flatten(board.draft as OwnData, []).bundle : null), [board]);

  if (!ready) return <p className="text-ink-muted">Looking for this board on this device…</p>;
  if (!board || !flat) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Not on this device</h1>
        <p className="text-ink-muted">
          This board isn&apos;t kept in this browser (boards made without signing in stay on the device that made them).{" "}
          <Link href="/boards" className="link">
            Back to the boards
          </Link>
        </p>
      </div>
    );
  }

  const collections = (board.draft.collections ?? []).map((c) => ({
    name: c.name,
    title: humanize(c.name),
    stats: c.stats,
    fixed: [],
    added: [],
    // Boards can't be added from here: they are on the server. Signed in, that is said plainly.
    choices: signedIn ? [] : undefined,
  }));

  function saveToAccount() {
    if (!board) return;
    start(async () => {
      setError(null);
      const out = await createBoard(board.draft, board.image, board.checks);
      if (!out.ok) {
        setError(out.errors[0] ?? "It couldn't be saved.");
        return;
      }
      removeLocalBoard(board.id);
      router.push(`/c/${out.id}`);
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          {board.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={board.image} alt="" className="float-right mb-1 ml-4 h-20 w-28 object-contain sm:h-24 sm:w-32" />
          )}
          <h1 className="text-3xl font-bold sm:text-4xl">{board.draft.title}</h1>
          <p className="mt-1 text-ink-muted">Kept on this device only</p>
          {board.draft.description && <p className="mt-2 whitespace-pre-line text-ink-muted">{board.draft.description}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link href={`/local/${board.id}/edit`} className="btn btn-primary">
            Edit
          </Link>
          <button
            type="button"
            className="btn text-danger"
            onClick={() => {
              if (window.confirm(`Delete "${board.draft.title}" from this device?`)) {
                removeLocalBoard(board.id);
                router.push("/boards");
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="sketch-box mb-4 flex flex-col gap-2 px-4 py-3">
        {signedIn ? (
          <>
            <p className="text-lg">This board is only in this browser. Save it to your account to keep it, share it and use it from other devices.</p>
            <div>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={saveToAccount}>
                {pending ? "Saving…" : "Save to my account"}
              </button>
            </div>
            {error && <p className="text-danger">{error}</p>}
          </>
        ) : (
          <p className="text-lg">
            This board is only in this browser: nobody else can open it, and clearing the browser&apos;s data removes it.{" "}
            <Link href={`/login?next=${encodeURIComponent(`/local/${board.id}`)}`} className="link">
              Sign in
            </Link>{" "}
            to save it to an account.
          </p>
        )}
      </div>

      <SharedCalculator
        flat={flat}
        formulas={board.draft.formulas}
        title={board.draft.title}
        collections={collections}
        presets={board.draft.presets}
        checks={board.checks}
      />
    </>
  );
}
