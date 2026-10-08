import Link from "next/link";

export default function BoardNotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">Board not found</h1>
      <p className="mt-2 text-ink-muted">Someone may have erased it, or the link is wrong.</p>
      <Link href="/new" className="link mt-6 inline-block">
        Create a new board
      </Link>
    </div>
  );
}
