import Link from "next/link";
import type { User } from "@/lib/auth";
import { listCalculationsByOwner } from "@/lib/db";

// The signed-in user's own calculations, newest first.
export function YourCalculations({ user }: { user: User }) {
  const calculations = listCalculationsByOwner(user.id);
  if (calculations.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-3 text-2xl font-bold">Your calculations</h2>
      <ul className="flex flex-col gap-1">
        {calculations.map((calc) => (
          <li key={calc.id}>
            <Link href={`/c/${calc.id}`} className="group flex items-baseline gap-3 py-1 text-xl">
              <span className="text-accent">→</span>
              <span className="group-hover:underline group-hover:decoration-wavy">{calc.title}</span>
              <span className="ml-auto text-base text-ink-faint">{new Date(calc.createdAt).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}