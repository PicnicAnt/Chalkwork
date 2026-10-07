// Shared types and validation for calculations. Safe to import from client and server.
import { analyzeFormulas, formulaProblems } from "./formulas";

export type CalculationDraft = {
  title: string;
  description: string;
  formulas: string[];
  // Starting values, keyed by variable name.
  values: Record<string, string>;
  // A short note on what each variable means, keyed by variable name.
  descriptions: Record<string, string>;
  // A unit label for each variable, such as % or m², keyed by variable name. Display only.
  units: Record<string, string>;
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
  variableDescription: 200,
  unit: 12,
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
  for (const problem of formulaProblems(analysis)) {
    errors.push(`Line ${problem.line}: ${problem.message}`);
  }

  const rawValues = typeof r.values === "object" && r.values !== null ? (r.values as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const v = str(rawValues[variable.name]).slice(0, LIMITS.value);
    if (v) values[variable.name] = v;
  }

  const rawDescriptions =
    typeof r.descriptions === "object" && r.descriptions !== null ? (r.descriptions as Record<string, unknown>) : {};
  const descriptions: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const d = str(rawDescriptions[variable.name]);
    if (d.length > LIMITS.variableDescription)
      errors.push(`The note on ${variable.name} must be at most ${LIMITS.variableDescription} characters.`);
    else if (d) descriptions[variable.name] = d;
  }

  const rawUnits = typeof r.units === "object" && r.units !== null ? (r.units as Record<string, unknown>) : {};
  const units: Record<string, string> = {};
  for (const variable of analysis.variables) {
    const u = str(rawUnits[variable.name]);
    if (u.length > LIMITS.unit) errors.push(`The unit of ${variable.name} must be at most ${LIMITS.unit} characters.`);
    else if (u) units[variable.name] = u;
  }

  return errors.length ? { errors } : { draft: { title, description, formulas, values, descriptions, units }, errors };
}
