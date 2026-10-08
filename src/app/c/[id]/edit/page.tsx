import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalculationEditor } from "@/components/CalculationEditor";
import { requireUser } from "@/lib/auth";
import { getCalculation, listAllCalculations } from "@/lib/db";
import { resolveIncludes } from "@/lib/resolve-boards";

async function load(id: string) {
  // better-sqlite3 is synchronous, so opt out of prerendering explicitly.
  await connection();
  const calculation = getCalculation(id);
  if (!calculation) notFound();
  return calculation;
}

export async function generateMetadata({ params }: PageProps<"/c/[id]/edit">): Promise<Metadata> {
  const calculation = await load((await params).id);
  return { title: `Edit ${calculation.title} · Chalkwork` };
}

// The owner edits their calculation in place. Anyone else who is signed in gets a copy of their
// own to change; saving makes a new calculation that they own.
export default async function EditCalculationPage({ params }: PageProps<"/c/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/c/${id}/edit`);
  const calculation = await load(id);
  const draft = {
    title: calculation.title,
    description: calculation.description,
    formulas: calculation.formulas,
    values: calculation.values,
    descriptions: calculation.descriptions,
    units: calculation.units,
    labels: calculation.labels,
    hidden: calculation.hidden,
    decimals: calculation.decimals,
    includes: calculation.includes,
    links: calculation.links,
  };
  const isOwner = calculation.ownerId === user.id;

  // The boards this one uses, loaded for the editor. When editing the owner's board, none of them
  // may use that board in turn.
  const resolved = resolveIncludes(calculation.includes, isOwner ? id : undefined);
  if ("error" in resolved) {
    return (
      <p className="sketch-box px-4 py-3 text-danger">
        This board uses another board that can&apos;t be loaded, so it can&apos;t be edited right now: {resolved.error}
      </p>
    );
  }
  const availableBoards = listAllCalculations().map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    ownerName: b.ownerName,
  }));

  if (isOwner) {
    return (
      <CalculationEditor
        initial={draft}
        editing={{ id }}
        heading={`Edit ${draft.title}`}
        availableBoards={availableBoards}
        initialIncluded={resolved.included}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sketch-box px-4 py-3 text-ink-muted">
        This calculation belongs to {calculation.ownerName ?? "someone else"}, so you can&apos;t change it. Saving here
        makes your own copy with a new link.
      </p>
      <CalculationEditor
        initial={{ ...draft, title: `${draft.title} (copy)` }}
        heading={`Copy ${draft.title}`}
        availableBoards={availableBoards}
        initialIncluded={resolved.included}
      />
    </div>
  );
}
