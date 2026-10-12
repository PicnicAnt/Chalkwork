"use client";

import type { Include, IncludedBundle } from "@/lib/boards";
import type { BoardChoice } from "./BoardPicker";
import { UsedBoard } from "./UsedBoard";

export type { BoardChoice };

// One variable of the type board: another board used inside this one. It goes by an alias (the variable's name), and
// its variables join this board as alias.name, ready to be used in formulas and linked with variables of this board or
// of other boards. Shown at the top of the box that holds that board's variables.
export function BoardRow({
  inc,
  includes,
  included,
  isOpen,
  onToggle,
  onAlias,
  onName,
  onPin,
  onRemove,
  children,
  handle,
}: {
  inc: Include;
  includes: Include[];
  included: IncludedBundle[];
  isOpen: (key: string) => boolean;
  onToggle: (key: string) => void;
  onAlias: (from: string, to: string) => void;
  onName: (alias: string, name: string) => void;
  onPin: (alias: string, version: number | undefined) => void;
  onRemove: (alias: string) => void;
  /** What is shown under the board's settings when it is opened: its variables. */
  children?: React.ReactNode;
  handle?: React.ReactNode;
}) {
  const found = included.find((i) => i.alias === inc.alias);
  return (
    <UsedBoard
      inc={inc}
      title={found?.title ?? "Board"}
      latest={found?.latest}
      otherAliases={includes.filter((i) => i.alias !== inc.alias).map((i) => i.alias)}
      expanded={isOpen(`board:${inc.alias}`)}
      onToggle={() => onToggle(`board:${inc.alias}`)}
      onAlias={(to) => onAlias(inc.alias, to)}
      onName={(name) => onName(inc.alias, name)}
      onPin={(version) => onPin(inc.alias, version)}
      onRemove={() => onRemove(inc.alias)}
      handle={handle}
    >
      {children}
    </UsedBoard>
  );
}
