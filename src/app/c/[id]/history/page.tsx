import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { RestoreButton } from "@/components/RestoreButton";
import { requireUser } from "@/lib/auth";
import { diffDrafts } from "@/lib/change-suggestions";
import { getBoard, listVersions } from "@/lib/db";

export const metadata: Metadata = { title: "History · Chalkwork" };

// Every save of a board, newest first, with what it changed, and a way back to any of them. The owner's page.
export default async function HistoryPage({ params }: PageProps<"/c/[id]/history">) {
  const { id } = await params;
  const user = await requireUser(`/c/${id}/history`);
  await connection();
  const board = getBoard(id);
  if (!board) notFound();
  if (board.ownerId !== user.id) redirect(`/c/${id}`);

  const versions = listVersions(id);
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-base text-ink-muted">
          <Link href={`/c/${id}`} className="link">
            {board.title}
          </Link>
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">History</h1>
        <p className="text-lg text-ink-muted">
          Every save is kept as a version. Boards that use this one can pin a version, so a change here doesn&apos;t
          reach them until they update.
        </p>
      </div>
      <ol className="flex flex-col gap-6">
        {versions.map((v, i) => {
          const changes = i + 1 < versions.length ? diffDrafts(versions[i + 1].draft, v.draft) : [];
          return (
            <li key={v.version} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3 text-xl">
                <span className="font-bold">Version {v.version}</span>
                {i === 0 && <span className="text-accent">current</span>}
                <span className="text-base text-ink-muted">
                  {new Date(v.savedAt).toLocaleString("en-GB")}
                  {v.savedByName ? ` · ${v.savedByName}` : ""}
                  {v.note ? ` · ${v.note}` : ""}
                </span>
              </div>
              {i + 1 === versions.length ? (
                <p className="text-ink-muted">The first version.</p>
              ) : changes.length === 0 ? (
                <p className="text-ink-muted">Nothing that shows on the board changed.</p>
              ) : (
                <ul className="sketch-box flex flex-col gap-1 px-4 py-2 text-lg">
                  {changes.slice(0, 12).map((line, n) => (
                    <li key={n} className="break-words">
                      {line}
                    </li>
                  ))}
                  {changes.length > 12 && <li className="text-ink-muted">and {changes.length - 12} more</li>}
                </ul>
              )}
              {i > 0 && <RestoreButton boardId={id} version={v.version} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
