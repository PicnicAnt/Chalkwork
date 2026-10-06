import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SharedCalculator } from "@/components/SharedCalculator";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { getCalculation } from "@/lib/db";

async function load(id: string) {
  // better-sqlite3 is synchronous, so opt out of prerendering explicitly.
  await connection();
  const calculation = getCalculation(id);
  if (!calculation) notFound();
  return calculation;
}

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const calculation = await load((await params).id);
  return { title: `${calculation.title} · Chalkwork`, description: calculation.description || undefined };
}

export default async function CalculationPage({ params }: PageProps<"/c/[id]">) {
  const calculation = await load((await params).id);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{calculation.title}</h1>
          {calculation.description && (
            <p className="mt-2 whitespace-pre-line text-ink-muted">{calculation.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <Link href={`/c/${calculation.id}/edit`} className="link text-lg">
            Edit
          </Link>
          <CopyLinkButton />
        </div>
      </div>
      <SharedCalculator calculation={calculation} />
    </>
  );
}
