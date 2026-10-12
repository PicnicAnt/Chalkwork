"use client";

import { useSyncExternalStore } from "react";
import { numberLocale, type NumberLocale } from "@/lib/locale";

// Told when the browser's language changes.
const subscribe = (onChange: () => void) => {
  window.addEventListener("languagechange", onChange);
  return () => window.removeEventListener("languagechange", onChange);
};

// The number style of the person's browser. The server (and the first render in the browser) use plain English
// numbers, then the page switches, so the page and what the server sent agree while it loads.
export function useNumberLocale(): NumberLocale {
  const tag = useSyncExternalStore(
    subscribe,
    () => (typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US"),
    () => "en-US",
  );
  return numberLocale(tag);
}
