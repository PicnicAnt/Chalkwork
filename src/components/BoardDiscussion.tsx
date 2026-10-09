"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/actions/discussion";
import { displayName } from "@/lib/formulas";
import { CollapsibleSection } from "./ui/CollapsibleSection";

export type CommentItem = { id: string; userName: string; variable: string | null; body: string; createdAt: string; canDelete: boolean };

// What other boards use this one, and a thread of comments on the board or on one of its variables. Shown to
// signed-in people only.
export function BoardDiscussion({
  boardId,
  comments,
  variables,
  usedBy,
}: {
  boardId: string;
  comments: CommentItem[];
  /** The variables a comment can be about, by name and the label shown for it. */
  variables: { name: string; label: string }[];
  usedBy: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [about, setAbout] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = (name: string) => variables.find((v) => v.name === name)?.label ?? displayName(name);

  function send() {
    setError(null);
    start(async () => {
      const out = await addComment(boardId, body, about || null);
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
    <>
      {usedBy.length > 0 && (
        <p className="text-base text-ink-muted" id="used-by">
          Used by {usedBy.length} {usedBy.length === 1 ? "board" : "boards"}:{" "}
          {usedBy.map((b, i) => (
            <span key={b.id}>
              {i > 0 && ", "}
              <Link href={`/c/${b.id}`} className="link">
                {b.title}
              </Link>
            </span>
          ))}
        </p>
      )}
      <div id="comments">
        <CollapsibleSection
          title="Comments"
          count={comments.length}
          description="Talk about this board or about one of its variables. The owner and anyone who has commented before is told when you write. Only signed-in people see comments."
        >
          {comments.length === 0 ? (
            <p className="text-ink-muted">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {comments.map((c) => (
                <li key={c.id} className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-3 text-base text-ink-muted">
                    <span className="text-lg text-ink">{c.userName}</span>
                    {c.variable && <span className="text-accent-2">about {label(c.variable)}</span>}
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    {c.canDelete && (
                      <button type="button" disabled={pending} onClick={() => remove(c.id)} className="link text-danger" aria-label={`Remove the comment by ${c.userName}`}>
                        Remove
                      </button>
                    )}
                  </span>
                  <span className="whitespace-pre-line text-xl">{c.body}</span>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea className="field w-full text-xl" rows={3} maxLength={1000} placeholder="Write a comment" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Comment" />
            <div className="flex flex-wrap items-baseline gap-3">
              <select value={about} onChange={(e) => setAbout(e.target.value)} className="cursor-pointer bg-transparent text-lg" aria-label="What the comment is about">
                <option value="">about the board</option>
                {variables.map((v) => (
                  <option key={v.name} value={v.name}>
                    about {v.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn" disabled={pending || !body.trim()}>
                Comment
              </button>
            </div>
          </form>
          {error && <p className="text-danger">{error}</p>}
        </CollapsibleSection>
      </div>
    </>
  );
}
