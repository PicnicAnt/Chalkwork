import { isVariableName, tokenize, type Analysis } from "./formulas";

// Why a new name for a variable can't be used, or null when it's fine.
export function checkVariableName(name: string, current: string, analysis: Analysis): string | null {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return "Use letters, digits and underscores, starting with a letter";
  if (!isVariableName(name)) return `"${name}" is a built-in name`;
  if (name !== current && analysis.variables.some((v) => v.name === name)) {
    return `"${name}" is already used by another variable`;
  }
  return null;
}

// Rewrites formula text so the variable `from` is called `to` everywhere it appears as a variable.
// Words that merely look the same (a function called sqrt, say) are left alone.
export function renameVariableInText(text: string, analysis: Analysis, from: string, to: string): string {
  let replaced = 0;
  const renamed = tokenize(text)
    .map((t) => {
      if (t.kind === "variable" && t.text === from) {
        replaced++;
        return to;
      }
      return t.text;
    })
    .join("");
  if (replaced > 0) return renamed;

  // A line without "name =" is shown as result_1, result_2 and so on. Give that line a real name.
  const formula = analysis.formulas.find((f) => f.name === from && !f.error);
  if (!formula) return text;
  const lines = text.split("\n");
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (++seen === formula.line) {
      lines[i] = `${to} = ${lines[i].trim()}`;
      break;
    }
  }
  return lines.join("\n");
}

// A copy of `record` with the key `from` moved to `to`.
export function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  if (!(from in record)) return record;
  const { [from]: moved, ...rest } = record;
  return { ...rest, [to]: moved };
}