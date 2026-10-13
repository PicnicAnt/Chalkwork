"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseLocalBoards, readLocalRaw, subscribeLocalBoards, type LocalBoard } from "@/lib/local-boards";

// The boards kept on this device, newest first. Empty on the server and for the first render in the browser, so the
// page and what the server sent agree while it loads.
export function useLocalBoards(): { boards: LocalBoard[]; ready: boolean } {
  const raw = useSyncExternalStore(subscribeLocalBoards, readLocalRaw, () => null);
  const boards = useMemo(() => (raw === null ? [] : parseLocalBoards(raw)), [raw]);
  return { boards, ready: raw !== null };
}
