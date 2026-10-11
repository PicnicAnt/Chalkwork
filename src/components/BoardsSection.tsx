"use client";

import type { Include, IncludedBundle } from "@/lib/boards";
import type { BoardChoice } from "./BoardPicker";
import { UsedBoard } from "./UsedBoard";
import { useFold } from "./ui/Foldable";

export type { BoardChoice };

// The variables of the type board: another board used inside this one. It goes by an alias (the variable's name), and
// its variables join this board as alias.name, ready to be used in formulas and linked with variables of this board or
// of other boards. Shown as rows of the variable list.
export function BoardRows({
  includes,
  included,
  error,
  onAlias,
  onName,
  onGroup,
  onPreset,
  onPin,
  onRemove,
}: {
  includes: Include[];
  included: IncludedBundle[];
  /** Why the last board couldn't be added, if it couldn't. */
  error: string | null;
  onAlias: (from: string, to: string) => void;
  onName: (alias: string, name: string) => void;
  onGroup: (alias: string, group: string) => void;
  onPreset: (alias: string, preset: string) => void;
  onPin: (alias: string, version: number | undefined) => void;
  onRemove: (alias: string) => void;
}) {
  const fold = useFold();
  return (
    <>
      {error && <p className="text-danger">{error}</p>}
      {includes.map((inc) => (
        <UsedBoard
          key={inc.alias}
          inc={inc}
          title={included.find((i) => i.alias === inc.alias)?.title ?? "Board"}
          latest={included.find((i) => i.alias === inc.alias)?.latest}
          otherAliases={includes.filter((i) => i.alias !== inc.alias).map((i) => i.alias)}
          expanded={fold.isOpen(inc.alias)}
          onToggle={() => fold.toggle(inc.alias)}
          onAlias={(to) => {
            onAlias(inc.alias, to);
            if (fold.isOpen(inc.alias)) fold.open(to);
          }}
          onName={(name) => onName(inc.alias, name)}
          onGroup={(group) => onGroup(inc.alias, group)}
          presetNames={Object.keys(included.find((i) => i.alias === inc.alias)?.presetValues ?? {})}
          onPreset={(preset) => onPreset(inc.alias, preset)}
          groups={[...new Set(includes.flatMap((i) => (i.group ? [i.group] : [])))]}
          onPin={(version) => onPin(inc.alias, version)}
          onRemove={() => onRemove(inc.alias)}
        />
      ))}
    </>
  );
}
