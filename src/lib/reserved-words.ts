// The names a formula can use that are not variables: constants and functions. A variable can't be given one of these
// names. The documented ones come first; every other built-in function name is reserved too (listed without a note).
import { create, all } from "mathjs";

export type ReservedWord = { name: string; use: string; text: string };

export const CONSTANT_WORDS: ReservedWord[] = [
  { name: "pi", use: "pi", text: "3.14159…, the ratio of a circle's circumference to its diameter" },
  { name: "tau", use: "tau", text: "2 × pi, a full turn in radians" },
  { name: "e", use: "e", text: "2.71828…, the base of natural logarithms" },
  { name: "phi", use: "phi", text: "1.618…, the golden ratio" },
  { name: "i", use: "i", text: "the imaginary unit, which has no use in a board but is kept for the maths" },
  { name: "null", use: "null", text: "nothing: not a value a board can use" },
  { name: "true", use: "true", text: "yes, the same as 1 in a condition" },
  { name: "false", use: "false", text: "no, the same as 0 in a condition" },
  { name: "PI", use: "PI", text: "the same as pi" },
  { name: "E", use: "E", text: "the same as e" },
  { name: "Infinity", use: "Infinity", text: "a value larger than any number" },
  { name: "NaN", use: "NaN", text: "not a number: what an impossible calculation gives" },
];

export const FUNCTION_WORDS: ReservedWord[] = [
  { name: "if", use: "if(condition, a, b)", text: "a when the condition holds, otherwise b" },
  { name: "min", use: "min(a, b, …)", text: "the smallest of the values" },
  { name: "max", use: "max(a, b, …)", text: "the largest of the values" },
  { name: "abs", use: "abs(x)", text: "x without its sign" },
  { name: "sqrt", use: "sqrt(x)", text: "square root of x" },
  { name: "cbrt", use: "cbrt(x)", text: "cube root of x" },
  { name: "pow", use: "pow(x, y)", text: "x to the power y (the same as x ^ y)" },
  { name: "exp", use: "exp(x)", text: "e to the power x" },
  { name: "log", use: "log(x) or log(x, base)", text: "natural logarithm, or the logarithm in the base given" },
  { name: "log10", use: "log10(x)", text: "logarithm in base 10" },
  { name: "log2", use: "log2(x)", text: "logarithm in base 2" },
  { name: "round", use: "round(x) or round(x, places)", text: "x to the nearest whole number, or to some decimals" },
  { name: "floor", use: "floor(x)", text: "x rounded down to a whole number" },
  { name: "ceil", use: "ceil(x)", text: "x rounded up to a whole number" },
  { name: "fix", use: "fix(x)", text: "x with the decimals cut off (toward zero)" },
  { name: "sign", use: "sign(x)", text: "-1, 0 or 1 by the sign of x" },
  { name: "mod", use: "mod(x, y)", text: "the remainder of x divided by y (the same as x % y)" },
  { name: "hypot", use: "hypot(a, b, …)", text: "the square root of the sum of the squares: the long side of a right triangle" },
  { name: "sin", use: "sin(x)", text: "sine of an angle in radians" },
  { name: "cos", use: "cos(x)", text: "cosine of an angle in radians" },
  { name: "tan", use: "tan(x)", text: "tangent of an angle in radians" },
  { name: "asin", use: "asin(x)", text: "the angle (in radians) whose sine is x" },
  { name: "acos", use: "acos(x)", text: "the angle (in radians) whose cosine is x" },
  { name: "atan", use: "atan(x)", text: "the angle (in radians) whose tangent is x" },
  { name: "atan2", use: "atan2(y, x)", text: "the angle of the point (x, y), in radians" },
  { name: "sinh", use: "sinh(x)", text: "hyperbolic sine" },
  { name: "cosh", use: "cosh(x)", text: "hyperbolic cosine" },
  { name: "tanh", use: "tanh(x)", text: "hyperbolic tangent" },
  { name: "mean", use: "mean(a, b, …)", text: "the average of the values" },
  { name: "median", use: "median(a, b, …)", text: "the middle value" },
  { name: "sum", use: "sum(a, b, …)", text: "the total of the values" },
  { name: "prod", use: "prod(a, b, …)", text: "the product of the values" },
  { name: "std", use: "std(a, b, …)", text: "the standard deviation of the values" },
  { name: "variance", use: "variance(a, b, …)", text: "the variance of the values" },
  { name: "factorial", use: "factorial(n)", text: "n × (n - 1) × … × 1" },
  { name: "gcd", use: "gcd(a, b)", text: "the greatest common divisor" },
  { name: "lcm", use: "lcm(a, b)", text: "the least common multiple" },
  { name: "combinations", use: "combinations(n, k)", text: "how many ways to choose k out of n" },
  { name: "permutations", use: "permutations(n, k)", text: "how many ordered ways to pick k out of n" },
  { name: "count", use: "count(a, b, …) or count(collection)", text: "how many values are given, or how many boards are in a collection" },
];

const documented = new Set([...CONSTANT_WORDS, ...FUNCTION_WORDS].map((w) => w.name));

// Every other function name of the maths library, which can't be a variable name either.
export function otherReservedNames(): string[] {
  const m = create(all) as unknown as Record<string, unknown>;
  return Object.keys(m)
    .filter((k) => /^[a-z][A-Za-z0-9]*$/.test(k) && typeof m[k] === "function" && !documented.has(k) && !k.startsWith("create"))
    .sort((a, b) => a.localeCompare(b));
}
