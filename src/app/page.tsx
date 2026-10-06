import Link from "next/link";
import { MyCalculations } from "@/components/MyCalculations";

export default function Home() {
  return (
    <>
      <section className="py-10">
        <h1 className="text-4xl font-bold tracking-tight">Build a calculation. Share it with a link.</h1>
        <p className="mt-4 max-w-xl text-lg text-black/60 dark:text-white/60">
          Define inputs and formulas once. Anyone with the link can plug in their own numbers and see the results
          instantly.
        </p>
        <Link
          href="/new"
          className="mt-8 inline-block rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Create a calculation
        </Link>
      </section>
      <MyCalculations />
    </>
  );
}
