import type { Metadata } from "next";
import { CalculationEditor } from "@/components/CalculationEditor";

export const metadata: Metadata = { title: "New calculation · CalcShare" };

export default function NewCalculationPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">New calculation</h1>
      <CalculationEditor />
    </>
  );
}
