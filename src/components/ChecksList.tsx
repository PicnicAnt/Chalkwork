import type { CheckResult } from "@/lib/checks";
import { displayName } from "@/lib/formulas";

// The checks of a board with whether each still holds: a tick, or a cross with what came out different.
export function ChecksList({
  results,
  labels,
  onRemove,
}: {
  results: CheckResult[];
  labels: Record<string, string>;
  onRemove?: (index: number) => void;
}) {
  const label = (name: string) => labels[name] || displayName(name);
  return (
    <ul className="flex flex-col gap-2">
      {results.map((r, i) => (
        <li key={`${r.name}-${i}`} className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-3 text-xl">
            <span className={r.ok ? "text-accent" : "text-danger"} aria-label={r.ok ? "Passes" : "Fails"}>
              {r.ok ? "✓" : "✗"}
            </span>
            <span className="min-w-0 flex-1 break-words">{r.name}</span>
            {onRemove && (
              <button type="button" className="link text-base text-danger" aria-label={`Remove the check ${r.name}`} onClick={() => onRemove(i)}>
                Remove
              </button>
            )}
          </div>
          {!r.ok && (
            <ul className="pl-7 text-base text-danger">
              {r.rows
                .filter((row) => !row.ok)
                .map((row) => (
                  <li key={row.name}>
                    {label(row.name)}: expected {row.expected}, now {row.got || "?"}
                  </li>
                ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
