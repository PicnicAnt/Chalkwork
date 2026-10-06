import type { Metadata } from "next";
import { CalculationEditor } from "@/components/CalculationEditor";

export const metadata: Metadata = { title: "New calculation · CalcShare" };

export default function NewCalculationPage() {
  return <CalculationEditor />;
}
