import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SharedCalculator } from "@/components/SharedCalculator";
import { DeleteBoardButton } from "@/components/DeleteBoardButton";
import { getCurrentUser } from "@/lib/auth";
import { boardsUsing, getBoard, listAllBoards, listScenarios } from "@/lib/db";
import { getVisibleBoard } from "@/lib/visible-board";
import { canOpen, isListed } from "@/lib/visibility";
import { ExplainBoard } from "@/components/ExplainBoard";
import { aiConfig } from "@/lib/ai";
import { UsedByList } from "@/components/UsedByList";
import { ViewCounter } from "@/components/ViewCounter";
import { acceptedExtras, groupsOf, resolveForView, type ExtraItem } from "@/lib/resolve-boards";
import { encodeItems, parseItems } from "@/lib/items-param";
import { outcomeOf, type Outcome } from "@/lib/scenarios";
import { analyzeFormulas, humanize } from "@/lib/formulas";
import { decodeState } from "@/lib/share-state";

async function load(id: string) {
  // better-sqlite3 is synchronous, so opt out of prerendering explicitly.
  await connection();
  const calculation = await getVisibleBoard(id);
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
  // Anyone else signed in can suggest a change. The owner finds suggestions under Suggestions.
  const canSuggest = user !== null && !isOwner;

  // The collections of the board and what is in them, for the "add an item" boxes.
  const known = groupsOf(full);
  const usedExtras = acceptedExtras(full, extras).filter((e) => {
    const b = getBoard(e.board);
    return b !== null && canOpen(b, user?.id);
  });
  // The name each added board goes by on the board, worked out as resolveForView does, so its box can say how to take it out.
  const aliasOf = new Map<ExtraItem, string>();
  {
    const taken = new Set(full.includes.map((i) => i.alias));
    acceptedExtras(full, extras).forEach((e, n) => {
      let alias = `item${n + 1}`;
      while (taken.has(alias)) alias += "_";
      taken.add(alias);
      aliasOf.set(e, alias);
    });
  }
  const choicesOf = (id: string) => {
    const b = getBoard(id);
    if (!b || b.id === full.id || !canOpen(b, user?.id)) return [];
    return [{ board: id, title: b.title, boardTitle: b.title }, ...b.presets.map((p) => ({ board: id, preset: p.name, title: `${b.title} · ${p.name}`, boardTitle: b.title }))];
  };
  let everyBoard: ReturnType<typeof choicesOf> | undefined;
  const anyBoard = () => (everyBoard ??= listAllBoards(300, user?.id).filter((b) => b.id !== full.id).flatMap((b) => choicesOf(b.id)));
  const collections = known.map((name) => ({
    name,
    title: humanize(name),
    stats: full.collections.find((c) => c.name === name)?.stats ?? [],
    fixed: full.includes.filter((i) => i.group === name).map((i) => ({ title: i.name || i.preset || getBoard(i.board)?.title || "A board" })),
    // The boards that can be added, each followed by its presets: the ones the collection lists, or any board.
    choices: full.collections.find((c) => c.name === name)?.boards?.length
      ? full.collections.find((c) => c.name === name)!.boards!.flatMap(choicesOf)
      : user
        ? anyBoard()
        : undefined,
    added: usedExtras.flatMap((e, index) => (e.group === name ? [{ index, alias: aliasOf.get(e) ?? "", title: `${getBoard(e.board)?.title ?? "A board"}${e.preset ? ` (${e.preset})` : ""}` }] : [])),
  }));
  // Scenarios saved with other boards added are another board to solve: worked out here, for the comparison table.
  const scenarios = user ? listScenarios(full.id, user.id) : undefined;
  const scenarioOutcomes: Record<string, Outcome> = {};
  for (const sc of scenarios ?? []) {
    if (!sc.items || encodeItems(sc.items) === encodeItems(usedExtras)) continue;
    const other = resolveForView(full, sc.items);
    if ("error" in other) continue;
    scenarioOutcomes[sc.id] = outcomeOf(analyzeFormulas(other.bundle.formulas, other.bundle.tables), sc, other.bundle.decimals);
  }

  return (
    <>
      {!isOwner && <ViewCounter boardId={calculation.id} />}
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
          {/* The button is drawn here from the first paint; the working menu (which knows the numbers on screen) is put
              on top of it once the page is ready, so the button is there straight away and nothing moves. */}
          <div id="share-slot" className="grid [&>*]:col-start-1 [&>*]:row-start-1">
            {!("error" in resolved) && (
              <span className="btn btn-primary" aria-hidden>
                Share ▾
              </span>
            )}
          </div>
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
          key={usedExtras.map((e) => `${e.group}:${e.board}:${e.preset ?? ""}`).join(",")}
          collections={collections}
          presets={full.presets}
          extras={usedExtras}
          flat={resolved.bundle}
          formulas={calculation.formulas}
          initialState={initialState ?? undefined}
          title={calculation.title}
          publicId={calculation.id}
          boardId={user ? calculation.id : undefined}
          scenarios={scenarios}
          scenarioOutcomes={scenarioOutcomes}
        />
      )}
      {user && (
        <div className="mt-8 flex flex-col gap-3">
          {"key" in aiConfig() && <ExplainBoard boardId={calculation.id} />}
          <UsedByList boards={boardsUsing(calculation.id).filter((b) => isListed(b, user.id)).map((b) => ({ id: b.id, title: b.title }))} />
        </div>
      )}
    </>
  );
}
