import type { Metadata } from "next";
import { BoardList } from "@/components/BoardList";
import { requireUser } from "@/lib/auth";
import { listAllBoards } from "@/lib/db";

export const metadata: Metadata = { title: "Boards · Chalkwork" };

// Every board by every user, or just your own, searchable. Only signed-in users can browse, so a board's link stays
// something you have to be given unless you have an account.
export default async function BoardsPage({ searchParams }: PageProps<"/boards">) {
  const { q, mine } = await searchParams;
  const wantsMine = mine === "1";
  const query = typeof q === "string" ? q : "";
  const params = new URLSearchParams();
  if (wantsMine) params.set("mine", "1");
  if (query) params.set("q", query);
  const user = await requireUser(params.size ? `/boards?${params}` : "/boards");
  const boards = listAllBoards().map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    createdAt: b.createdAt,
    ownerName: b.ownerName,
    isMine: b.ownerId === user.id,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Boards</h1>
      <BoardList boards={boards} initialQuery={query} initialMine={wantsMine} />
    </div>
  );
}