import type { Metadata } from "next";
import { BoardEditor } from "@/components/BoardEditor";
import { requireUser } from "@/lib/auth";
import { listAllBoards } from "@/lib/db";

export const metadata: Metadata = { title: "New board · Chalkwork" };

export default async function NewBoardPage() {
  await requireUser("/new");
  // Every existing board can be added to the new one.
  const availableBoards = listAllBoards().map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    ownerName: b.ownerName,
  }));
  return <BoardEditor availableBoards={availableBoards} />;
}
