import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalculatorView } from "@/components/CalculatorView";
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
  return { title: `${calculation.title} · CalcShare`, description: calculation.description || undefined };
}

export default async function CalculationPage({ params }: PageProps<"/c/[id]">) {
  const calculation = await load((await params).id);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{calculation.title}</h1>
          {calculation.description && (
            <p className="mt-1 whitespace-pre-line text-black/60 dark:text-white/60">{calculation.description}</p>
          )}
        </div>
        <CopyLinkButton />
      </div>
      <CalculatorView calculation={calculation} />
    </>
  );
}
