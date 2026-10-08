"use client";

import type { Include, IncludedBundle } from "@/lib/boards";
import { BoardPicker, type BoardChoice } from "./BoardPicker";
import { UsedBoard } from "./UsedBoard";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { ExpandAllBar, useFold } from "./ui/Foldable";

export type { BoardChoice };

// The boards this board uses. "Add an existing board" opens a search of all boards; the chosen one goes by
// an alias, and its variables join this board as alias.name, ready to be used in formulas and to be linked
// with variables of this board or of other boards in use.
export function BoardsSection({
  includes,
  included,
  available,
  busy,
  error,
  onAdd,
  onAlias,
  onName,
  onRemove,
}: {
  includes: Include[];
  included: IncludedBundle[];
  available: BoardChoice[];
  /** True while a board is being loaded. */
  busy: boolean;
  /** Why the last board couldn't be added, if it couldn't. */
  error: string | null;
  onAdd: (boardId: string) => void;
  onAlias: (from: string, to: string) => void;
  onName: (alias: string, name: string) => void;
  onRemove: (alias: string) => void;
}) {
  const fold = useFold();

  return (
    <CollapsibleSection
      title="Boards used"
      count={includes.length}
      description={
        <>
          Another board&apos;s variables can be added to this one. They appear as <em>name.variable</em>, and you can
          use them in formulas and link them with your own variables or with those of other boards, for example{" "}
          <span className="text-accent-2">weapon.damage = my_damage</span>. Linked variables follow each other either
          way.
        </>
      }
    >
      <BoardPicker available={available} busy={busy} onAdd={onAdd} />
      {error && <p className="text-danger">{error}</p>}

      {includes.length > 0 && (
        <>
          <ExpandAllBar onExpandAll={() => fold.expandAll(includes.map((i) => i.alias))} onCollapseAll={fold.collapseAll} />
          <div className="flex flex-col gap-3">
            {includes.map((inc) => (
              <UsedBoard
                key={inc.alias}
                inc={inc}
                title={included.find((i) => i.alias === inc.alias)?.title ?? "Board"}
                otherAliases={includes.filter((i) => i.alias !== inc.alias).map((i) => i.alias)}
                expanded={fold.isOpen(inc.alias)}
                onToggle={() => fold.toggle(inc.alias)}
                onAlias={(to) => {
                  onAlias(inc.alias, to);
                  if (fold.isOpen(inc.alias)) fold.open(to);
                }}
                onName={(name) => onName(inc.alias, name)}
                onRemove={() => onRemove(inc.alias)}
              />
            ))}
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
