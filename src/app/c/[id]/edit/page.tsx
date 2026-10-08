import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalculationEditor } from "@/components/CalculationEditor";
import { requireUser } from "@/lib/auth";
import { getCalculation } from "@/lib/db";

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
    decimals: calculation.decimals,
  };

  if (calculation.ownerId === user.id) {
    return <CalculationEditor initial={draft} editing={{ id }} heading={`Edit ${draft.title}`} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="sketch-box px-4 py-3 text-ink-muted">
        This calculation belongs to {calculation.ownerName ?? "someone else"}, so you can&apos;t change it. Saving here
        makes your own copy with a new link.
      </p>
      <CalculationEditor initial={{ ...draft, title: `${draft.title} (copy)` }} heading={`Copy ${draft.title}`} />
    </div>
  );
}