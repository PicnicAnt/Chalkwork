import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReviewActions } from "@/components/ReviewActions";
import { StatusBadge } from "@/components/SuggestionList";
import { requireUser } from "@/lib/auth";
import { boardStamp, getCalculation, getSuggestion } from "@/lib/db";
import { diffDrafts, draftOf } from "@/lib/change-suggestions";

export const metadata: Metadata = { title: "Suggestion · Chalkwork" };

// One suggestion: who made it, what it changes, and, for the owner, the buttons to answer it.
export default async function SuggestionPage({ params }: PageProps<"/c/[id]/suggestions/[sid]">) {
  const { id, sid } = await params;
  const user = await requireUser(`/c/${id}/suggestions/${sid}`);
  await connection();
  const s = getSuggestion(sid);
  if (!s || s.boardId !== id) notFound();
  const isOwner = s.boardOwnerId === user.id;
  const isAuthor = s.authorId === user.id;
  // Only the two people involved can read it.
  if (!isOwner && !isAuthor) notFound();

  const board = getCalculation(id);
  if (!board) notFound();
  const changes = diffDrafts(draftOf(board), s.draft);
  const changedSince = s.status === "open" && boardStamp(id) !== s.baseStamp;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-base text-ink-muted">
          <Link href={`/c/${id}`} className="link">
            {s.boardTitle}
          </Link>{" "}
          · suggested by {s.authorName} · {new Date(s.createdAt).toLocaleString("en-GB")}
        </p>
        <h1 className="flex flex-wrap items-baseline justify-between gap-3 text-3xl font-bold sm:text-4xl">
          Suggested change
          <StatusBadge status={s.status} />
        </h1>
        {s.message && <p className="whitespace-pre-line text-xl">{s.message}</p>}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">What changes</h2>
        {changes.length === 0 ? (
          <p className="text-ink-muted">
            {s.status === "approved" ? "It is now what the board says." : "It no longer differs from the board."}
          </p>
        ) : (
          <ul className="sketch-box flex flex-col gap-1 px-4 py-3 text-lg">
            {changes.map((line, i) => (
              <li key={i} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>

      {changedSince && (
        <p className="sketch-box px-4 py-3 text-accent">
          The board has been changed since this was suggested, so the list above compares with how it is now.
          Approving replaces the board with the suggested version.
        </p>
      )}

      {s.status === "rejected" && s.decisionNote && (
        <p className="sketch-box px-4 py-3">
          <span className="text-ink-muted">Reason for rejecting: </span>
          {s.decisionNote}
        </p>
      )}

      {s.status === "open" && isOwner && <ReviewActions id={s.id} role="owner" />}
      {s.status === "open" && isAuthor && !isOwner && <ReviewActions id={s.id} role="author" />}

      <p>
        <Link href="/suggestions" className="link text-lg">
          All suggestions
        </Link>
      </p>
    </div>
  );
}
