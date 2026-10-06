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