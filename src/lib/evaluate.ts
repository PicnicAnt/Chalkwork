import { all, create } from "mathjs";
import { toVariableName, type CalcInput, type CalcOutput } from "./calculation";

const math = create(all);
const evaluateExpression = math.evaluate.bind(math);

// Formulas come from other users, so disable the functions that can define or change things.
const disabled = ["import", "createUnit", "reviver", "evaluate", "parse", "simplify", "derivative", "resolve", "compile"];
math.import(
  Object.fromEntries(
    disabled.map((name) => [
      name,
      () => {
        throw new Error(`${name} is not allowed`);
      },
    ]),
  ),
  { override: true },
);

export type OutputResult = { label: string; name: string; value?: string; error?: string };

function format(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return math.format(value, { precision: 10 });
}

function parseInputValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const num = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(num) ? num : trimmed;
}

// Evaluates results in order. Each result can use the inputs and any result above it.
export function evaluateCalculation(inputs: CalcInput[], outputs: CalcOutput[]): OutputResult[] {
  const scope = new Map<string, unknown>();
  for (const input of inputs) {
    const name = toVariableName(input.label);
    if (name) scope.set(name, parseInputValue(input.value));
  }

  return outputs.map((output) => {
    const name = toVariableName(output.label);
    if (!output.formula.trim()) return { label: output.label, name, error: "No formula yet" };
    try {
      const raw = evaluateExpression(output.formula, scope);
      if (typeof raw === "function") throw new Error("Formula must produce a value");
      if (name) scope.set(name, raw);
      return { label: output.label, name, value: format(raw) };
    } catch (e) {
      return { label: output.label, name, error: e instanceof Error ? e.message : "Invalid formula" };
    }
  });
}
