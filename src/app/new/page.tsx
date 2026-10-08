import type { Metadata } from "next";
import { CalculationEditor } from "@/components/CalculationEditor";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New calculation · Chalkwork" };

export default async function NewCalculationPage() {
  await requireUser("/new");
  return <CalculationEditor />;
}