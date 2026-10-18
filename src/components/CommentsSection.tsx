"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/actions/comments";
import { COMMENT_LIMITS } from "@/lib/comments";
import { CollapsibleSection } from "./ui/CollapsibleSection";

export type CommentView = { id: string; authorId: string; authorName: string; variable: string; variableLabel: string; body: string; createdAt: string };

// Comments on a board, or on one of its variables: a short thread under the board. Anyone can read it; writing needs a
// sign-in. The writer and the owner of the board can remove a comment.
export function CommentsSection({
  boardId,
  comments,
  variables,
  userId,
  ownerId,
}: {
  boardId: string;
  comments: CommentView[];
  /** The variables a comment can be about, with the names the board shows. */
  variables: { name: string; label: string }[];
  /** Set when someone is signed in. */
  userId?: string;
  ownerId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [about, setAbout] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const out = await addComment(boardId, about, body);
      if (!out.ok) {
        setError(out.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteComment(id);
      router.refresh();
    });
  }

  return (
    <CollapsibleSection title="Comments" count={comments.length} description="Questions and notes about this board or one of its variables.">
      {comments.length === 0 ? (
        <p className="text-ink-muted">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="sketch-box flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 text-base text-ink-muted">
                <span className="text-lg text-ink">{c.authorName}</span>
                {c.variableLabel && <span>on {c.variableLabel}</span>}
                <time dateTime={c.createdAt}>{new Date(c.createdAt.includes("T") ? c.createdAt : `${c.createdAt.replace(" ", "T")}Z`).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
                {userId && (userId === c.authorId || userId === ownerId) && (
                  <button type="button" disabled={pending} onClick={() => remove(c.id)} className="link ml-auto text-danger" aria-label={`Remove the comment by ${c.authorName}`}>
                    Remove
                  </button>
                )}
              </div>
              <p className="whitespace-pre-line break-words text-lg">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {userId ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            className="field min-h-20 text-lg"
            value={body}
            maxLength={COMMENT_LIMITS.body}
            placeholder="Write a comment"
            onChange={(e) => setBody(e.target.value)}
            aria-label="Comment"
          />
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <label className="flex items-baseline gap-2 text-lg">
              <span className="text-ink-muted">About</span>
              <select value={about} onChange={(e) => setAbout(e.target.value)} className="cursor-pointer bg-transparent text-lg" aria-label="What the comment is about">
                <option value="">the board</option>
                {variables.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn" disabled={pending || !body.trim()}>
              Post comment
            </button>
          </div>
          {error && <p className="text-danger">{error}</p>}
        </form>
      ) : (
        <p className="text-ink-muted">Sign in to write a comment.</p>
      )}
    </CollapsibleSection>
  );
}
