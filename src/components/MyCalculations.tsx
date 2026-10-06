"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadMyCalculations } from "@/lib/my-calculations";

// localStorage only exists in the browser, so render nothing on the server and read it after hydration.
const subscribe = () => () => {};
let cached: { raw: string | null; list: ReturnType<typeof loadMyCalculations> } | null = null;
function getSnapshot() {
  const raw = localStorage.getItem("calcshare:mine");
  if (!cached || cached.raw !== raw) cached = { raw, list: loadMyCalculations() };
  return cached.list;
}

export function MyCalculations() {
  const calculations = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!calculations || calculations.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        Created in this browser
      </h2>
      <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
        {calculations.map((calc) => (
          <li key={calc.id}>
            <Link href={`/c/${calc.id}`} className="flex justify-between gap-4 px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5">
              <span className="font-medium">{calc.title}</span>
              <span className="text-sm text-black/50 dark:text-white/50">
                {new Date(calc.createdAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
