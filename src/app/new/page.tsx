import type { Metadata } from "next";
import { CalculationEditor } from "@/components/CalculationEditor";

export const metadata: Metadata = { title: "New calculation · Chalkwork" };

export default function NewCalculationPage() {
  return <CalculationEditor />;
}
