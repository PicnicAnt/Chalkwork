import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SharedCalculator } from "@/components/SharedCalculator";
import { DeleteBoardButton } from "@/components/DeleteBoardButton";
import { getCurrentUser } from "@/lib/auth";
import { boardsUsing, getBoard, listComments, listScenarios, listSuggestionsForBoard } from "@/lib/db";
import { ExplainBoard } from "@/components/ExplainBoard";
import { aiConfig } from "@/lib/ai";
import { BoardDiscussion } from "@/components/BoardDiscussion";
import type { Bundle } from "@/lib/boards";
import { analyzeFormulas, displayName } from "@/lib/formulas";
import { resolveForView } from "@/lib/resolve-boards";
import { decodeState } from "@/lib/share-state";

async function load(id: string) {
  // better-sqlite3 is synchronous, so opt out of prerendering explicitly.
  await connection();
  const calculation = getBoard(id);
  if (!calculation) notFound();
  return calculation;
}

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const calculation = await load((await params).id);
  return { title: `${calculation.title} · Chalkwork`, description: calculation.description || undefined };
}

// The variables a comment can be about: the ones people see, with the names they see.
function discussable(bundle: Bundle): { name: string; label: string }[] {
  return analyzeFormulas(bundle.formulas, bundle.tables)
    .variables.filter((v) => bundle.hidden[v.name] !== true)
    .map((v) => ({ name: v.name, label: bundle.labels[v.name] || displayName(v.name) }));
}

export default async function BoardPage({ params, searchParams }: PageProps<"/c/[id]">) {
  const full = await load((await params).id);
  // A link can carry someone's typed values (see lib/share-state.ts).
  const { state } = await searchParams;
  const initialState = decodeState(typeof state === "string" ? state : undefined);
  const { ownerId, ...calculation } = full;
  // The board together with the boards it uses.
  const resolved = resolveForView(full);
  const user = await getCurrentUser();
  const isOwner = user !== null && user.id === ownerId;
  // The owner sees how many suggestions wait; anyone else signed in can make one (if there is an owner).
  const openSuggestions = isOwner ? listSuggestionsForBoard(calculation.id).filter((s) => s.status === "open").length : 0;
  const canSuggest = user !== null && !isOwner && ownerId !== null;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{calculation.title}</h1>
          {calculation.ownerName && <p className="mt-1 text-ink-muted">by {calculation.ownerName}</p>}
          {calculation.description && (
            <p className="mt-2 whitespace-pre-line text-ink-muted">{calculation.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {isOwner && (
            <Link href={`/c/${calculation.id}/history`} className="link text-lg">
              History
            </Link>
          )}
          {isOwner && (
            <Link href={`/suggestions`} className="link text-lg">
              Suggestions{openSuggestions > 0 ? ` (${openSuggestions})` : ""}
            </Link>
          )}
          {canSuggest && (
            <Link href={`/c/${calculation.id}/suggest`} className="link text-lg">
              Suggest a change
            </Link>
          )}
          <Link href={`/c/${calculation.id}/edit`} className="link text-lg">
            {isOwner ? "Edit" : "Make a copy"}
          </Link>
          {isOwner && <DeleteBoardButton id={calculation.id} title={calculation.title} />}
        </div>
      </div>
      {"error" in resolved ? (
        <p className="sketch-box px-4 py-3 text-danger">
          This board uses another board that can&apos;t be loaded: {resolved.error}
        </p>
      ) : (
        <SharedCalculator
          flat={resolved.bundle}
          formulas={calculation.formulas}
          initialState={initialState ?? undefined}
          title={calculation.title}
          publicId={calculation.id}
          boardId={user ? calculation.id : undefined}
          scenarios={user ? listScenarios(calculation.id, user.id) : undefined}
          editable={isOwner ? { boardId: calculation.id, ownLinks: calculation.links } : undefined}
        />
      )}
      {user && !("error" in resolved) && (
        <div className="mt-8 flex flex-col gap-3">
          {"key" in aiConfig() && <ExplainBoard boardId={calculation.id} />}
          <BoardDiscussion
            boardId={calculation.id}
            comments={listComments(calculation.id).map((c) => ({
              id: c.id,
              userName: c.userName,
              variable: c.variable,
              body: c.body,
              createdAt: c.createdAt,
              canDelete: c.userId === user.id || isOwner,
            }))}
            variables={discussable(resolved.bundle)}
            usedBy={boardsUsing(calculation.id).map((b) => ({ id: b.id, title: b.title }))}
          />
        </div>
      )}
    </>
  );
}
