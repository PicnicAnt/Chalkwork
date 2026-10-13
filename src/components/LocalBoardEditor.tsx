"use client";

import Link from "next/link";
import { BoardEditor } from "./BoardEditor";
import { useLocalBoards } from "./useLocalBoards";

// Loads a board kept on this device into the editor.
export function LocalBoardEditor({ id }: { id: string }) {
  const { boards, ready } = useLocalBoards();
  const board = boards.find((b) => b.id === id);
  if (!ready) return <p className="text-ink-muted">Looking for this board on this device…</p>;
  if (!board) {
    return (
      <p className="text-ink-muted">
        This board isn&apos;t kept in this browser.{" "}
        <Link href="/boards" className="link">
          Back to the boards
        </Link>
      </p>
    );
  }
  return (
    <BoardEditor
      key={board.id}
      local={{ id: board.id }}
      initial={board.draft}
      initialImage={board.image}
      initialChecks={board.checks}
      heading={`Edit ${board.draft.title}`}
    />
  );
}
