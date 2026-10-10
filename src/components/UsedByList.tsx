import Link from "next/link";

// Which other boards use this one. Shown to signed-in people only.
export function UsedByList({ boards }: { boards: { id: string; title: string }[] }) {
  if (boards.length === 0) return null;
  return (
    <p className="text-base text-ink-muted" id="used-by">
      Used by {boards.length} {boards.length === 1 ? "board" : "boards"}:{" "}
      {boards.map((b, i) => (
        <span key={b.id}>
          {i > 0 && ", "}
          <Link href={`/c/${b.id}`} className="link">
            {b.title}
          </Link>
        </span>
      ))}
    </p>
  );
}
