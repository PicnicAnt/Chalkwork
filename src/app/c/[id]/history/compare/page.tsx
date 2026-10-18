import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { diffDrafts, summarizeChanges } from "@/lib/change-suggestions";
import { getBoard, getVersion } from "@/lib/db";

export const metadata: Metadata = { title: "Compare versions · Chalkwork" };

// Two versions of a board side by side: what changed in words, and the formulas of each with the lines that
// differ marked. The owner's page, reached from History.
export default async function ComparePage({ params, searchParams }: PageProps<"/c/[id]/history/compare">) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const user = await requireUser(`/c/${id}/history/compare?from=${encodeURIComponent(String(from ?? ""))}&to=${encodeURIComponent(String(to ?? ""))}`);
  await connection();
  const board = getBoard(id);
  if (!board) notFound();
  if (board.ownerId !== user.id) redirect(`/c/${id}`);

  const a = Number(typeof from === "string" ? from : NaN);
  const b = Number(typeof to === "string" ? to : NaN);
  const left = Number.isInteger(a) ? getVersion(id, a) : null;
  const right = Number.isInteger(b) ? getVersion(id, b) : null;
  if (!left || !right) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold sm:text-4xl">Compare versions</h1>
        <p className="text-ink-muted">
          Those versions don&apos;t exist.{" "}
          <Link href={`/c/${id}/history`} className="link">
            Back to History
          </Link>
        </p>
      </div>
    );
  }

  const changes = diffDrafts(left, right);
  const inLeft = new Set(left.formulas);
  const inRight = new Set(right.formulas);

  const column = (title: string, formulas: string[], other: Set<string>, mark: string, markClass: string) => (
    <div className="flex min-w-0 flex-col gap-2">
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className="sketch-box flex flex-col gap-1 px-3 py-2 text-lg">
        {formulas.length === 0 && <li className="text-ink-muted">No formulas</li>}
        {formulas.map((f, i) => (
          <li key={i} className={`break-words ${other.has(f) ? "" : markClass}`}>
            {!other.has(f) && <span className="mr-2">{mark}</span>}
            {f}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-base text-ink-muted">
          <Link href={`/c/${id}/history`} className="link">
            History
          </Link>{" "}
          of {board.title}
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          Version {a} and version {b}
        </h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">What changed</h2>
        {summarizeChanges(left, right) && <p className="text-xl">{summarizeChanges(left, right)}</p>}
        {changes.length === 0 ? (
          <p className="text-ink-muted">Nothing that shows on the board is different.</p>
        ) : (
          <ul className="sketch-box flex flex-col gap-1 px-4 py-2 text-lg">
            {changes.map((line, n) => (
              <li key={n} className="break-words">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {column(`Version ${a}`, left.formulas, inRight, "−", "text-danger")}
        {column(`Version ${b}`, right.formulas, inLeft, "+", "text-accent")}
      </section>
    </div>
  );
}
