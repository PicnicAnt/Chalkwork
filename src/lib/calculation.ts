// Shared types and validation for calculations. Safe to import from client and server.
import { analyzeFormulas } from "./formulas";

export type CalculationDraft = {
  title: string;
  description: string;
  formulas: string[];
  // Starting values, keyed by variable name.
  values: Record<string, string>;
};

export type Calculation = CalculationDraft & {
  id: string;
  createdAt: string;
};

export const LIMITS = {
  title: 120,
  description: 1000,
  formula: 500,
  formulas: 50,
  value: 50,
};

// The editor holds formulas as one block of text, one per line.
export function splitFormulas(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateDraft(raw: unknown): { draft?: CalculationDraft; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return { errors: ["Invalid data."] };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const formulas = (Array.isArray(r.formulas) ? r.formulas : []).map(str).filter(Boolean);
  const title = str(r.title);
  const description = str(r.description);

  if (!title) errors.push("Give the calculation a title.");
  if (title.length > LIMITS.title) errors.push(`Title must be at most ${LIMITS.title} characters.`);
  if (description.length > LIMITS.description)
    errors.push(`Description must be at most ${LIMITS.description} characters.`);
  if (formulas.length === 0) errors.push("Write at least one formula.");
  if (formulas.length > LIMITS.formulas) errors.push(`At most ${LIMITS.formulas} formulas.`);
  if (formulas.some((f) => f.length > LIMITS.formula))
    errors.push(`Each formula must be at most ${LIMITS.formula} characters.`);
  if (errors.length) return { errors };

  const analysis = analyzeFormulas(formulas);
  for (const f of analysis.formulas) {
    if (f.error) errors.push(`Line ${f.line}: ${f.error}`);
  }

  const rawValues = typeof r.values === "object" && r.values !== null ? (r.values as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const v = str(rawValues[variable.name]).slice(0, LIMITS.value);
    if (v) values[variable.name] = v;
  }

  return errors.length ? { errors } : { draft: { title, description, formulas, values }, errors };
}
