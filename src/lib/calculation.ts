// Shared types and validation for calculations. Safe to import from client and server.

export type CalcInput = { label: string; value: string };
export type CalcOutput = { label: string; formula: string };

export type CalculationDraft = {
  title: string;
  description: string;
  inputs: CalcInput[];
  outputs: CalcOutput[];
};

export type Calculation = CalculationDraft & {
  id: string;
  createdAt: string;
};

export const LIMITS = {
  title: 120,
  description: 1000,
  label: 60,
  formula: 500,
  value: 50,
  inputs: 30,
  outputs: 30,
};

// "Loan amount (USD)" -> "loan_amount_usd". This is the name formulas use to refer to a row.
export function toVariableName(label: string): string {
  return label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const VARIABLE_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateDraft(raw: unknown): { draft?: CalculationDraft; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return { errors: ["Invalid data."] };
  const r = raw as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const rows = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((x) => typeof x === "object" && x !== null) as Record<string, unknown>[];

  const draft: CalculationDraft = {
    title: str(r.title),
    description: str(r.description),
    // Rows left completely blank in the editor are ignored rather than rejected.
    inputs: rows(r.inputs)
      .map((x) => ({ label: str(x.label), value: str(x.value) }))
      .filter((x) => x.label || x.value),
    outputs: rows(r.outputs)
      .map((x) => ({ label: str(x.label), formula: str(x.formula) }))
      .filter((x) => x.label || x.formula),
  };

  if (!draft.title) errors.push("Give the calculation a title.");
  if (draft.title.length > LIMITS.title) errors.push(`Title must be at most ${LIMITS.title} characters.`);
  if (draft.description.length > LIMITS.description)
    errors.push(`Description must be at most ${LIMITS.description} characters.`);
  if (draft.inputs.length > LIMITS.inputs) errors.push(`At most ${LIMITS.inputs} inputs.`);
  if (draft.outputs.length === 0) errors.push("Add at least one result.");
  if (draft.outputs.length > LIMITS.outputs) errors.push(`At most ${LIMITS.outputs} results.`);

  const seen = new Set<string>();
  for (const row of [...draft.inputs, ...draft.outputs]) {
    const name = toVariableName(row.label);
    if (!row.label) errors.push("Every input and result needs a label.");
    else if (row.label.length > LIMITS.label) errors.push(`"${row.label}" is longer than ${LIMITS.label} characters.`);
    else if (!VARIABLE_PATTERN.test(name)) errors.push(`"${row.label}" must start with a letter.`);
    else if (seen.has(name)) errors.push(`Two rows share the name "${name}".`);
    seen.add(name);
  }
  for (const input of draft.inputs) {
    if (input.value.length > LIMITS.value) errors.push(`Default value for "${input.label}" is too long.`);
  }
  for (const output of draft.outputs) {
    if (!output.formula) errors.push(`"${output.label || "Result"}" needs a formula.`);
    if (output.formula.length > LIMITS.formula) errors.push(`Formula for "${output.label}" is too long.`);
  }

  return errors.length ? { errors: [...new Set(errors)] } : { draft, errors };
}
