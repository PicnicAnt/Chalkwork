import Link from "next/link";
import type { Suggestion, SuggestionStatus } from "@/lib/db";

const STATUS: Record<SuggestionStatus, { text: string; className: string }> = {
  open: { text: "Waiting for an answer", className: "text-accent" },
  approved: { text: "Approved", className: "text-ink" },
  rejected: { text: "Rejected", className: "text-danger" },
  withdrawn: { text: "Withdrawn", className: "text-ink-faint" },
};

export function StatusBadge({ status }: { status: SuggestionStatus }) {
  return <span className={`shrink-0 text-base ${STATUS[status].className}`}>{STATUS[status].text}</span>;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

// A list of suggestions, each linking to its review page. `show` says whether to name the board and
// the person who suggested it, or just the board.
export function SuggestionList({ suggestions, who }: { suggestions: Suggestion[]; who: "author" | "owner" }) {
  if (suggestions.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <li key={s.id}>
          <Link href={`/c/${s.boardId}/suggestions/${s.id}`} className="group flex flex-col gap-0.5">
            <span className="flex items-baseline justify-between gap-3 text-xl">
              <span className="min-w-0 truncate group-hover:underline group-hover:decoration-wavy">
                {s.boardTitle}
                <span className="text-base text-ink-muted">
                  {who === "author" ? "" : ` · from ${s.authorName}`} · {day(s.createdAt)}
                </span>
              </span>
              <StatusBadge status={s.status} />
            </span>
            {s.message && <span className="line-clamp-1 text-base text-ink-muted">{s.message}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
