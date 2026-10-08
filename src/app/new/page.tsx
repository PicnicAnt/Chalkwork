import type { Metadata } from "next";
import { CalculationEditor } from "@/components/CalculationEditor";
import { requireUser } from "@/lib/auth";
import { listAllCalculations } from "@/lib/db";

export const metadata: Metadata = { title: "New calculation · Chalkwork" };

export default async function NewCalculationPage() {
  await requireUser("/new");
  // Every existing board can be added to the new one.
  const availableBoards = listAllCalculations().map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    ownerName: b.ownerName,
  }));
  return <CalculationEditor availableBoards={availableBoards} />;
}
