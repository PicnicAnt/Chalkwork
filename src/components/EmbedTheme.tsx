"use client";

import { useEffect } from "react";

// An embedded board takes its colours from ?theme=light or ?theme=dark, and otherwise from the visitor's own setting.
export function EmbedTheme() {
  useEffect(() => {
    const theme = new URLSearchParams(location.search).get("theme");
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  }, []);
  return null;
}
