"use client";

import { BOARD_LIMITS, checkAlias, type Include } from "@/lib/boards";
import { Foldable } from "./ui/Foldable";
import { useCommitField } from "./ui/useCommitField";

// One board this board uses: the name shown for it on the board, the alias its variables go by in formulas,
// and a way to stop using it.
export function UsedBoard({
  inc,
  title,
  latest,
  otherAliases,
  expanded,
  onToggle,
  onAlias,
  onName,
  onPin,
  onRemove,
}: {
  inc: Include;
  /** The board's own title. */
  title: string;
  /** The newest version of the board. */
  latest?: number;
  otherAliases: string[];
  expanded: boolean;
  onToggle: () => void;
  onAlias: (to: string) => void;
  onName: (name: string) => void;
  /** Pins the board to a version, or follows its latest again (undefined). */
  onPin: (version: number | undefined) => void;
  onRemove: () => void;
}) {
  // The alias rewrites formulas, so it is applied when the field is left, not on every keystroke.
  const alias = useCommitField(inc.alias, (next) => {
    if (next === inc.alias) return null;
    const problem = checkAlias(next) ?? (otherAliases.includes(next) ? `"${next}" is already used for another board` : null);
    if (problem) return problem;
    onAlias(next);
    return null;
  });

  return (
    <Foldable expanded={expanded} onToggle={onToggle} summary={inc.name || title} hint={` · used as ${inc.alias}${inc.version ? ` · version ${inc.version}` : ""}`}>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <a
          href={`/c/${inc.board}`}
          target="_blank"
          rel="noopener"
          className="link min-w-0 flex-1 basis-40 truncate text-lg"
          title="Open this board in a new tab"
        >
          {title}
        </a>
        <input
          className="field w-48 text-lg"
          value={inc.name ?? ""}
          maxLength={BOARD_LIMITS.name}
          placeholder="Name on the board"
          onChange={(e) => onName(e.target.value)}
          aria-label={`Name shown for ${title}`}
          title="What this board is called here, for example Player or Enemy"
        />
        <label className="flex items-baseline gap-2 text-lg text-ink-muted">
          used as
          <input
            {...alias.inputProps}
            className={`field w-40 text-xl text-ink ${alias.error ? "!border-danger" : ""}`}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={`Name used for ${title}`}
          />
        </label>
        <button type="button" onClick={onRemove} className="link text-base text-danger" aria-label={`Stop using ${title}`}>
          Remove
        </button>
      </div>
      {alias.error && <span className="text-sm text-danger">{alias.error}</span>}
      {latest !== undefined && latest > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-3 text-base text-ink-muted">
          {inc.version ? (
            <>
              <span>
                Pinned to version {inc.version}
                {latest > inc.version ? ` (version ${latest} is newer)` : ""}.
              </span>
              {latest > inc.version && (
                <button type="button" onClick={() => onPin(latest)} className="link">
                  Update to version {latest}
                </button>
              )}
              <button type="button" onClick={() => onPin(undefined)} className="link">
                Follow the latest
              </button>
            </>
          ) : (
            <>
              <span>Follows the latest version (now {latest}), so changes to it show up here.</span>
              <button type="button" onClick={() => onPin(latest)} className="link">
                Pin to version {latest}
              </button>
            </>
          )}
        </p>
      )}
    </Foldable>
  );
}
