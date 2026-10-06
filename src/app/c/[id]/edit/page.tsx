import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EditCalculation } from "@/components/EditCalculation";
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
  return { title: `Edit ${calculation.title} · CalcShare` };
}

export default async function EditCalculationPage({ params }: PageProps<"/c/[id]/edit">) {
  const calculation = await load((await params).id);
  return <EditCalculation calculation={calculation} />;
}
