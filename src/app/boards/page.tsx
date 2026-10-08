import type { Metadata } from "next";
import { BoardList } from "@/components/BoardList";
import { requireUser } from "@/lib/auth";
import { listAllCalculations } from "@/lib/db";

export const metadata: Metadata = { title: "Browse · Chalkwork" };

// Every board by every user, searchable. Only signed-in users can browse, so a board's link stays
// something you have to be given unless you have an account.
export default async function BoardsPage({ searchParams }: PageProps<"/boards">) {
  const { q } = await searchParams;
  const user = await requireUser(q ? `/boards?q=${encodeURIComponent(String(q))}` : "/boards");
  const boards = listAllCalculations().map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    createdAt: b.createdAt,
    ownerName: b.ownerName,
    isMine: b.ownerId === user.id,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold sm:text-4xl">All boards</h1>
      <BoardList boards={boards} initialQuery={typeof q === "string" ? q : ""} />
    </div>
  );
}