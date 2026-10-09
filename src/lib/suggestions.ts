import { tokenize } from "./formulas";

export type Suggestion = {
  /** What gets inserted in place of the typed word. */
  text: string;
  kind: "variable" | "function" | "constant";
  hint?: string;
};

export type SuggestionList = {
  /** The part of the text being completed: from `start` up to the caret. */
  start: number;
  end: number;
  word: string;
  items: Suggestion[];
};

const FUNCTIONS: [string, string][] = [
  ["if", "if(condition, a, b)"],
  ["sqrt", "square root"],
  ["cbrt", "cube root"],
  ["abs", "absolute value"],
  ["round", "round(x) or round(x, digits)"],
  ["floor", "round down"],
  ["ceil", "round up"],
  ["fix", "round toward zero"],
  ["min", "smallest of"],
  ["max", "largest of"],
  ["sum", "add up"],
  ["mean", "average"],
  ["median", "middle value"],
  ["pow", "pow(x, y)"],
  ["exp", "e to the power of"],
  ["log", "natural log, log(x, base)"],
  ["log10", "log base 10"],
  ["log2", "log base 2"],
  ["sin", ""],
  ["cos", ""],
  ["tan", ""],
  ["asin", ""],
  ["acos", ""],
  ["atan", ""],
  ["atan2", "atan2(y, x)"],
  ["sinh", ""],
  ["cosh", ""],
  ["tanh", ""],
  ["mod", "remainder"],
  ["sign", "-1, 0 or 1"],
  ["hypot", "length of the hypotenuse"],
  ["factorial", ""],
  ["gamma", ""],
];

const CONSTANTS: [string, string][] = [
  ["pi", "3.14159…"],
  ["e", "2.71828…"],
  ["tau", "2 × pi"],
  ["phi", "golden ratio"],
  ["Infinity", ""],
];

// A dot is part of a word so that board.variable can be completed as one name.
const WORD = /[A-Za-z0-9_.]/;
const MAX_ITEMS = 6;

// Works out what to offer for the word being typed at `caret`: variables already used in the
// formulas first, then functions and constants. Returns null when there's nothing to offer.
export function suggest(text: string, caret: number, extraNames: readonly string[] = []): SuggestionList | null {
  if (caret < 1 || caret > text.length) return null;

  let start = caret;
  while (start > 0 && WORD.test(text[start - 1])) start--;
  const word = text.slice(start, caret);
  if (!/^[A-Za-z_]/.test(word)) return null; // empty, or a number
  if (caret < text.length && WORD.test(text[caret])) return null; // editing the middle of a word

  // Variables used elsewhere in the text, in order of first appearance, not counting this word.
  const known: string[] = [];
  let offset = 0;
  for (const token of tokenize(text)) {
    const tokenStart = offset;
    offset += token.text.length;
    if (token.kind !== "variable" || tokenStart === start) continue;
    if (!known.includes(token.text)) known.push(token.text);
  }

  // Variables of the boards in use, written board.variable, as well as the ones already typed.
  for (const name of extraNames) if (!known.includes(name)) known.push(name);

  const lower = word.toLowerCase();
  const candidates: Suggestion[] = [
    ...known.map((name): Suggestion => ({ text: name, kind: "variable" })),
    ...(word.length >= 2 && !word.includes(".")
      ? [
          ...FUNCTIONS.map(([name, hint]): Suggestion => ({ text: name, kind: "function", hint })),
          ...CONSTANTS.map(([name, hint]): Suggestion => ({ text: name, kind: "constant", hint })),
        ]
      : []),
  ].filter((c) => c.text !== word);

  const prefix = candidates.filter((c) => c.text.toLowerCase().startsWith(lower));
  // Longer words can also match in the middle (typing "dmg" finds "inc_dmg").
  const inside =
    word.length >= 3 ? candidates.filter((c) => !prefix.includes(c) && c.text.toLowerCase().includes(lower)) : [];
  const items = [...prefix, ...inside].slice(0, MAX_ITEMS);
  return items.length ? { start, end: caret, word, items } : null;
}
