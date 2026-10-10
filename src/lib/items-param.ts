import type { ExtraItem } from "./resolve-boards";

// The items people add to a board's collections are kept in the address (?items=gear:abc123,gear:def456), so a link
// to a board with its items can be shared. Plain logic, so it is the same on the server and in the browser.

export const MAX_EXTRA_ITEMS = 20;

export function parseItems(raw: string | undefined): ExtraItem[] {
  if (!raw) return [];
  const items: ExtraItem[] = [];
  for (const part of raw.split(",")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]{0,29}):([A-Za-z0-9_-]{6,24})$/.exec(part.trim());
    if (m) items.push({ group: m[1], board: m[2] });
    if (items.length >= MAX_EXTRA_ITEMS) break;
  }
  return items;
}

export const encodeItems = (items: readonly ExtraItem[]): string => items.map((i) => `${i.group}:${i.board}`).join(",");
