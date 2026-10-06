"use client";

import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";

// The current theme lives on <html data-theme>, set before paint by the layout's inline script.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getTheme = () => (document.documentElement.getAttribute("data-theme") as Theme) ?? "dark";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);
  if (!theme) return <span className="w-8" />;
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem("theme", next);
        } catch {
          // Not saved, but the switch still applies for this visit.
        }
      }}
      className="btn px-3 py-1 text-base"
      aria-label={`Switch to ${next === "dark" ? "blackboard" : "whiteboard"}`}
      title={`Switch to ${next === "dark" ? "blackboard" : "whiteboard"}`}
    >
      {next === "dark" ? "Blackboard" : "Whiteboard"}
    </button>
  );
}
