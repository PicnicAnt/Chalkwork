import Link from "next/link";
import { YourCalculations } from "@/components/YourCalculations";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

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
          dps = avg_hit * aps * crit_factor * hit_chance / 100
        </p>
        <Link href="/new" className="btn btn-primary mt-8">
          {user ? "Start a calculation" : "Sign in to start"}
        </Link>
      </section>
      {user && <YourCalculations user={user} />}
    </>
  );
}