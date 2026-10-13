import type { Metadata } from "next";
import { connection } from "next/server";
import { BoardList } from "@/components/BoardList";
import { getCurrentUser } from "@/lib/auth";
import { listAllBoards } from "@/lib/db";

export const metadata: Metadata = { title: "Boards · Chalkwork" };

// Every board anyone can open, searchable, and your own too when you are signed in. Signed out, the public boards are
// listed; boards that are only open by link, or private, are not.
export default async function BoardsPage({ searchParams }: PageProps<"/boards">) {
  const { q, sort, tags, mine } = await searchParams;
  await connection();
  const user = await getCurrentUser();
  const wantsMine = mine === "1" && user !== null;
  const query = typeof q === "string" ? q : "";
  const tagList = typeof tags === "string" ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const boards = listAllBoards(1000, user?.id).map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    views: b.views,
    ownerName: b.ownerName,
    isMine: user !== null && b.ownerId === user.id,
    tags: b.tags,
    keywords: b.keywords,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Boards</h1>
      <BoardList
        boards={boards}
        signedIn={user !== null}
        initialQuery={query}
        initialMine={wantsMine}
        initialSort={typeof sort === "string" ? sort : undefined}
        initialTags={tagList}
      />
    </div>
  );
}
