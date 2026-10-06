import Link from "next/link";
import { MyCalculations } from "@/components/MyCalculations";

export default function Home() {
  return (
    <>
      <section className="py-6 sm:py-10">
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Write the formulas.
          <br />
          Share the board.
        </h1>
        <p className="mt-5 max-w-xl text-xl text-ink-muted">
          Put a few formulas up, and anyone with the link can change any number and watch the rest work themselves
          out.
        </p>
        <p className="mt-6 text-xl text-accent-2">
          payment = loan * rate / (1 - (1 + rate) ^ -months)
        </p>
        <Link href="/new" className="btn btn-primary mt-8">
          Start a calculation
        </Link>
      </section>
      <MyCalculations />
    </>
  );
}
