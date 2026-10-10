import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SharedCalculator } from "@/components/SharedCalculator";
import { DeleteBoardButton } from "@/components/DeleteBoardButton";
import { getCurrentUser } from "@/lib/auth";
import { boardsUsing, getBoard, listAllBoards, listScenarios } from "@/lib/db";
import { ExplainBoard } from "@/components/ExplainBoard";
import { aiConfig } from "@/lib/ai";
import { UsedByList } from "@/components/UsedByList";
import { groupsOf, resolveForView } from "@/lib/resolve-boards";
import { parseItems } from "@/lib/items-param";
import { humanize } from "@/lib/formulas";
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

export default async function BoardPage({ params, searchParams }: PageProps<"/c/[id]">) {
  const full = await load((await params).id);
  // A link can carry someone's typed values (see lib/share-state.ts).
  const { state, items } = await searchParams;
  // Items people using the board added to its collections (kept in the address).
  const extras = parseItems(typeof items === "string" ? items : undefined);
  const initialState = decodeState(typeof state === "string" ? state : undefined);
  const { ownerId, ...calculation } = full;
  // The board together with the boards it uses.
  const resolved = resolveForView(full, extras);
  const user = await getCurrentUser();
  const isOwner = user !== null && user.id === ownerId;
  // Anyone else signed in can suggest a change (if there is an owner). The owner finds suggestions under Suggestions.
  const canSuggest = user !== null && !isOwner && ownerId !== null;

  // The collections of the board and what is in them, for the "add an item" boxes.
  const known = groupsOf(full);
  const usedExtras = extras.filter((e) => known.includes(e.group) && e.board !== full.id);
  const collections = known.map((name) => ({
    name,
    title: humanize(name),
    stats: (full.collections ?? []).find((c) => c.name === name)?.stats ?? [],
    fixed: full.includes.filter((i) => i.group === name).map((i) => ({ title: i.name || getBoard(i.board)?.title || "A board" })),
    added: usedExtras.flatMap((e, index) => (e.group === name ? [{ index, title: getBoard(e.board)?.title ?? "A board" }] : [])),
  }));
  const boardChoices = user && known.length > 0 ? listAllBoards().filter((b) => b.id !== full.id).map((b) => ({ id: b.id, title: b.title })) : [];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{calculation.title}</h1>
          {(calculation.ownerName || isOwner) && (
            <p className="mt-1 text-ink-muted">
              {calculation.ownerName && <>by {calculation.ownerName}</>}
              {isOwner && (
                <>
                  {calculation.ownerName && " · "}
                  <Link href={`/c/${calculation.id}/history`} className="link">
                    History
                  </Link>
                </>
              )}
            </p>
          )}
          {calculation.description && (
            <p className="mt-2 whitespace-pre-line text-ink-muted">{calculation.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {/* The Share menu is put here by the board below, which knows the numbers on screen. */}
          <div id="share-slot" />
          {canSuggest && (
            <Link href={`/c/${calculation.id}/suggest`} className="btn">
              Suggest a change
            </Link>
          )}
          <Link href={`/c/${calculation.id}/edit`} className="btn btn-primary">
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
          key={usedExtras.map((e) => `${e.group}:${e.board}`).join(",")}
          collections={collections}
          boardChoices={boardChoices}
          extras={usedExtras}
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
      {user && (
        <div className="mt-8 flex flex-col gap-3">
          {"key" in aiConfig() && <ExplainBoard boardId={calculation.id} />}
          <UsedByList boards={boardsUsing(calculation.id).map((b) => ({ id: b.id, title: b.title }))} />
        </div>
      )}
    </>
  );
}
