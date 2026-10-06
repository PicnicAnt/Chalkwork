import Link from "next/link";

export default function CalculationNotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Calculation not found</h1>
      <p className="mt-2 text-black/60 dark:text-white/60">The link may be wrong, or the calculation no longer exists.</p>
      <Link href="/new" className="mt-6 inline-block text-blue-600 hover:underline dark:text-blue-400">
        Create a new calculation
      </Link>
    </div>
  );
}
