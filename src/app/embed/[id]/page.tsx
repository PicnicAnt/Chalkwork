import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EmbedTheme } from "@/components/EmbedTheme";
import { SharedCalculator } from "@/components/SharedCalculator";
import { getBoard } from "@/lib/db";
import { resolveForView } from "@/lib/resolve-boards";
import { decodeState } from "@/lib/share-state";

export const metadata: Metadata = { title: "Chalkwork" };

// A board to put in another page with an iframe: just the board, with a link back. ?theme=light or dark picks
// the colours, and ?state=… (see Copy link with these values) starts it with someone's numbers.
export default async function EmbeddedBoardPage({ params, searchParams }: PageProps<"/embed/[id]">) {
  await connection();
  const { id } = await params;
  const { state } = await searchParams;
  const board = getBoard(id);
  if (!board) notFound();
  const resolved = resolveForView(board);
  const initialState = decodeState(typeof state === "string" ? state : undefined);

  return (
    <div className="flex flex-col gap-4">
      <EmbedTheme />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{board.title}</h1>
        <a href={`/c/${id}`} target="_blank" rel="noopener" className="link text-base">
          Open on Chalkwork
        </a>
      </div>
      {"error" in resolved ? (
        <p className="text-danger">This board can&apos;t be shown: {resolved.error}</p>
      ) : (
        <SharedCalculator flat={resolved.bundle} initialState={initialState ?? undefined} />
      )}
    </div>
  );
}
