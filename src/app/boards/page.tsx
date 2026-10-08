import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAllCalculations } from "@/lib/db";

export const metadata: Metadata = { title: "Browse · Chalkwork" };

// Every board by every user. Only signed-in users can browse, so a board's link stays something
// you have to be given unless you have an account.
export default async function BoardsPage() {
  const user = await requireUser("/boards");
  const boards = listAllCalculations();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold sm:text-4xl">All boards</h1>
        <span className="text-ink-muted">{boards.length === 1 ? "1 board" : `${boards.length} boards`}</span>
      </div>

      {boards.length === 0 ? (
        <p className="text-ink-muted">Nothing has been put on a board yet.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {boards.map((board) => (
            <li key={board.id}>
              <Link href={`/c/${board.id}`} className="group flex flex-col gap-0.5">
                <span className="flex items-baseline gap-3 text-xl">
                  <span className="text-accent">→</span>
                  <span className="group-hover:underline group-hover:decoration-wavy">{board.title}</span>
                </span>
                {board.description && (
                  <span className="line-clamp-2 pl-7 text-base text-ink-muted">{board.description}</span>
                )}
                <span className="pl-7 text-sm text-ink-faint">
                  {board.ownerName ? `by ${board.ownerName}${board.ownerId === user.id ? " (you)" : ""}` : "no owner"}
                  {" · "}
                  {new Date(board.createdAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}