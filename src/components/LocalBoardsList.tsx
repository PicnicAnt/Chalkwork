"use client";

import Link from "next/link";
import { useLocalBoards } from "./useLocalBoards";

// The boards made on this device without signing in, with a note on what that means.
export function LocalBoardsList({ heading = "On this device" }: { heading?: string }) {
  const { boards } = useLocalBoards();
  if (boards.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-2xl font-bold">
        {heading} <span className="text-lg font-normal text-ink-muted">({boards.length})</span>
      </h2>
      <p className="text-base text-ink-muted">Kept in this browser only: nobody else can open them. Sign in to save a board to your account.</p>
      <ul className="flex flex-col gap-2">
        {boards.map((b) => (
          <li key={b.id}>
            <Link href={`/local/${b.id}`} className="group flex items-center gap-3 py-1 text-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.image ? <img src={b.image} alt="" className="h-10 w-14 shrink-0 rounded object-cover" /> : <span className="h-10 w-14 shrink-0" aria-hidden />}
              <span className="group-hover:underline group-hover:decoration-wavy">{b.draft.title}</span>
              <span className="ml-auto text-base text-ink-faint">{new Date(b.updatedAt).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
