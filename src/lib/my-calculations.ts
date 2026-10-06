// Remembers calculations created in this browser. There are no accounts yet, so this is
// how the home page lists "your" calculations without exposing everyone else's.

export type SavedCalculation = { id: string; title: string; createdAt: string };

const KEY = "calcshare:mine";

export function loadMyCalculations(): SavedCalculation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rememberCalculation(calc: SavedCalculation) {
  try {
    const rest = loadMyCalculations().filter((c) => c.id !== calc.id);
    localStorage.setItem(KEY, JSON.stringify([calc, ...rest].slice(0, 100)));
  } catch {
    // Storage can be unavailable (private mode); the share link still works.
  }
}
