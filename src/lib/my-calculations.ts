// Remembers calculations created in this browser, along with the key that allows editing them.
// There are no accounts yet, so this is how "your" calculations and edit rights are tracked.

export type SavedCalculation = { id: string; title: string; createdAt: string; editKey?: string };

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
    const existing = loadMyCalculations();
    const previous = existing.find((c) => c.id === calc.id);
    const rest = existing.filter((c) => c.id !== calc.id);
    // An update doesn't hand out a new key, so keep the one we have.
    const entry = { ...calc, editKey: calc.editKey ?? previous?.editKey };
    localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, 100)));
  } catch {
    // Storage can be unavailable (private mode); the share link still works.
  }
}

export function getEditKey(id: string): string | undefined {
  return loadMyCalculations().find((c) => c.id === id)?.editKey;
}
