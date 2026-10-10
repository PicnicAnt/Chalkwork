import type { Metadata } from "next";
import Link from "next/link";
import { AiStarter } from "@/components/AiStarter";
import { BoardEditor } from "@/components/BoardEditor";
import { aiConfig } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { listAllBoards } from "@/lib/db";
import { BLANK_ID, TEMPLATES, templateById } from "@/lib/templates";

export const metadata: Metadata = { title: "New board · Chalkwork" };

// Pick where to start (a template or a blank board), then write the board in the editor.
export default async function NewBoardPage({ searchParams }: PageProps<"/new">) {
  const { template } = await searchParams;
  await requireUser(typeof template === "string" ? `/new?template=${encodeURIComponent(template)}` : "/new");

  if (typeof template !== "string") {
    const helper = "key" in aiConfig();
    const choices = helper ? listAllBoards().map((b) => ({ id: b.id, title: b.title, description: b.description, ownerName: b.ownerName })) : [];
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold sm:text-4xl">New board</h1>
          <p className="text-xl text-ink-muted">
            A board is a few formulas that you can use in any direction. Start from one that is made, or from nothing.
          </p>
        </div>
        {helper && <AiStarter availableBoards={choices} />}
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <li key={t.id}>
              <Link href={`/new?template=${t.id}`} className="sketch-box group flex h-full flex-col gap-1 px-4 py-3">
                <span className="text-2xl group-hover:underline group-hover:decoration-wavy">{t.title}</span>
                <span className="text-base text-ink-muted">{t.blurb}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href={`/new?template=${BLANK_ID}`} className="sketch-box group flex h-full flex-col gap-1 px-4 py-3">
              <span className="text-2xl group-hover:underline group-hover:decoration-wavy">Start from nothing</span>
              <span className="text-base text-ink-muted">An empty board: write your own formulas.</span>
            </Link>
          </li>
        </ul>
      </div>
    );
  }

  // Every existing board can be added to the new one.
  const availableBoards = listAllBoards().map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    ownerName: b.ownerName,
  }));
  return <BoardEditor availableBoards={availableBoards} initial={templateById(template)?.draft} />;
}
