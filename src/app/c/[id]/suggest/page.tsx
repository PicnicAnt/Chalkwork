import type { Metadata } from "next";
import { boardChoices } from "@/lib/board-choices";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BoardEditor } from "@/components/BoardEditor";
import { aiConfig } from "@/lib/ai";
import { requireUser } from "@/lib/auth";

import { getVisibleBoard } from "@/lib/visible-board";
import { resolveIncludes } from "@/lib/resolve-boards";
import { draftOf } from "@/lib/change-suggestions";

export const metadata: Metadata = { title: "Suggest a change · Chalkwork" };

// Someone else's board, changed in the editor and sent to its owner, who approves or rejects it.
export default async function SuggestPage({ params }: PageProps<"/c/[id]/suggest">) {
  const { id } = await params;
  const user = await requireUser(`/c/${id}/suggest`);
  await connection();
  const board = await getVisibleBoard(id);
  if (!board) notFound();
  if (board.ownerId === user.id) redirect(`/c/${id}/edit`);

  if (board.ownerId === null) {
    return (
      <p className="sketch-box px-4 py-3 text-ink-muted">
        This board has no owner, so there is nobody to approve a change. You can make your own copy instead.
      </p>
    );
  }
  const resolved = resolveIncludes(board.includes, id);
  if ("error" in resolved) {
    return (
      <p className="sketch-box px-4 py-3 text-danger">
        This board uses another board that can&apos;t be loaded, so a change can&apos;t be suggested right now:{" "}
        {resolved.error}
      </p>
    );
  }
  const availableBoards = boardChoices(user.id);

  return (
    <div className="flex flex-col gap-6">
      <p className="sketch-box px-4 py-3 text-ink-muted">
        This board belongs to {board.ownerName ?? "someone else"}. Change it here and send it as a suggestion: nothing
        changes on the board until {board.ownerName ?? "the owner"} approves it.
      </p>
      <BoardEditor
        aiEnabled={"key" in aiConfig()}
        initial={draftOf(board)}
        suggesting={{ boardId: id }}
        heading={`Suggest a change to ${board.title}`}
        availableBoards={availableBoards}
        initialIncluded={resolved.included}
      />
    </div>
  );
}
