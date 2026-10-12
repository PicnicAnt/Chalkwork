"use client";

import { useEffect } from "react";
import { recordView } from "@/app/actions/views";

// Tells the server the board was opened, once per browser session, so reloads and changes made on the page don't
// count again. Draws nothing.
export function ViewCounter({ boardId }: { boardId: string }) {
  useEffect(() => {
    try {
      const key = `viewed:${boardId}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Without session storage it is counted on every load, which is acceptable.
    }
    void recordView(boardId);
  }, [boardId]);
  return null;
}
