// Units. A variable's unit is a label such as m, cm², km/h or $. Here the label is understood: which
// kind of quantity it measures (its dimension, as powers of length, mass, time and so on) and how large it is
// next to the base unit (its factor). That is enough to check that formulas fit together, and to show a value
// in another unit of the same kind (cm for m, h for min).
//
// Pure logic, used in the editor (to check) and on boards (to convert).

export type Dim = Record<string, number>;
export type Unit = { dim: Dim; factor: number };

const L = (n: number): Dim => ({ L: n });
const M: Dim = { M: 1 };
const T = (n: number): Dim => ({ T: n });
const ENERGY: Dim = { M: 1, L: 2, T: -2 };
const POWER: Dim = { M: 1, L: 2, T: -3 };

// Base units of a kind with their size in the SI unit (m, kg, s, J, W).
const TABLE: Record<string, Unit> = {
  m: { dim: L(1), factor: 1 },
  mm: { dim: L(1), factor: 0.001 },
  cm: { dim: L(1), factor: 0.01 },
  km: { dim: L(1), factor: 1000 },
  in: { dim: L(1), factor: 0.0254 },
  ft: { dim: L(1), factor: 0.3048 },
  yd: { dim: L(1), factor: 0.9144 },
  mi: { dim: L(1), factor: 1609.344 },
  kg: { dim: M, factor: 1 },
  g: { dim: M, factor: 0.001 },
  mg: { dim: M, factor: 1e-6 },
  t: { dim: M, factor: 1000 },
  lb: { dim: M, factor: 0.45359237 },
  oz: { dim: M, factor: 0.028349523125 },
  s: { dim: T(1), factor: 1 },
  ms: { dim: T(1), factor: 0.001 },
  min: { dim: T(1), factor: 60 },
  h: { dim: T(1), factor: 3600 },
  d: { dim: T(1), factor: 86400 },
  Hz: { dim: T(-1), factor: 1 },
  L: { dim: L(3), factor: 0.001 },
  mL: { dim: L(3), factor: 1e-6 },
  J: { dim: ENERGY, factor: 1 },
  kJ: { dim: ENERGY, factor: 1000 },
  Wh: { dim: ENERGY, factor: 3600 },
  kWh: { dim: ENERGY, factor: 3.6e6 },
  W: { dim: POWER, factor: 1 },
  kW: { dim: POWER, factor: 1000 },
  MW: { dim: POWER, factor: 1e6 },
  // A percentage is a plain number written differently: formulas that use it divide by 100 themselves.
  "%": { dim: {}, factor: 1 },
  // Currencies and pixels can't be converted into each other (there is no rate), so each is its own kind.
  $: { dim: { "$": 1 }, factor: 1 },
  USD: { dim: { "$": 1 }, factor: 1 },
  "€": { dim: { "€": 1 }, factor: 1 },
  EUR: { dim: { "€": 1 }, factor: 1 },
  "£": { dim: { "£": 1 }, factor: 1 },
  GBP: { dim: { "£": 1 }, factor: 1 },
  px: { dim: { px: 1 }, factor: 1 },
};

const SUPERSCRIPT: Record<string, number> = { "²": 2, "³": 3, "⁻¹": -1, "⁻²": -2 };

const times = (dim: Dim, by: number): Dim => {
  const out: Dim = {};
  for (const [k, v] of Object.entries(dim)) if (v * by !== 0) out[k] = v * by;
  return out;
};
const plus = (a: Dim, b: Dim): Dim => {
  const out: Dim = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + v;
    if (out[k] === 0) delete out[k];
  }
  return out;
};

export const sameDim = (a: Dim, b: Dim) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

// One term such as m, cm², s^-1 or km: its unit raised to its power.
function parseTerm(term: string): Unit | null {
  const m = /^([^\d^²³⁻]+)(\^-?\d+|²|³|⁻¹|⁻²)?$/.exec(term);
  if (!m) return null;
  const base = TABLE[m[1]];
  if (!base) return null;
  const power = !m[2] ? 1 : m[2].startsWith("^") ? Number(m[2].slice(1)) : SUPERSCRIPT[m[2]];
  return { dim: times(base.dim, power), factor: base.factor ** power };
}

// Understands a unit label, or returns null when it isn't a unit known here (then nothing is checked or
// converted for it): "m²", "km/h", "/s", "kWh", "$", "%".
export function parseUnit(label: string | undefined): Unit | null {
  const text = (label ?? "").trim().replace(/[·*]/g, " ");
  if (!text) return null;
  const slash = text.indexOf("/");
  const [top, bottom] = slash < 0 ? [text, ""] : [text.slice(0, slash), text.slice(slash + 1)];
  let out: Unit = { dim: {}, factor: 1 };
  for (const [part, sign] of [[top, 1], [bottom, -1]] as const) {
    for (const term of part.split(/\s+/).filter(Boolean)) {
      const u = parseTerm(term);
      if (!u) return null;
      out = { dim: plus(out.dim, times(u.dim, sign)), factor: out.factor * u.factor ** sign };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Other units of the same kind

const sup = (n: number) => (n === 1 ? "" : n === 2 ? "²" : n === 3 ? "³" : `^${n}`);
const powered = (units: string[], n: number) => units.map((u) => `${u}${sup(n)}`);
const LENGTH = ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"];

// Labels offered when a value is shown in a unit other than the one it was written in.
const CANDIDATES: string[] = [
  ...powered(LENGTH, 1),
  ...powered(LENGTH, 2),
  ...powered(LENGTH, 3),
  "mL",
  "L",
  "mg",
  "g",
  "kg",
  "t",
  "oz",
  "lb",
  "ms",
  "s",
  "min",
  "h",
  "d",
  "/s",
  "/min",
  "/h",
  "m/s",
  "km/h",
  "mi/h",
  "ft/s",
  "J",
  "kJ",
  "Wh",
  "kWh",
  "W",
  "kW",
  "MW",
];

// The labels of the same kind as this one (the same dimension), this one first, or none if it is not a
// unit that can be converted.
export function alternatives(label: string | undefined): string[] {
  const unit = parseUnit(label);
  // Only quantities with a scale of their own convert (length, mass, time and what is made of them);
  // currencies, pixels and percentages stay as they are.
  if (!unit || Object.keys(unit.dim).length === 0 || Object.keys(unit.dim).some((k) => !["L", "M", "T"].includes(k))) return [];
  const same = CANDIDATES.filter((c) => {
    const u = parseUnit(c);
    return u && sameDim(u.dim, unit.dim);
  });
  const first = (label ?? "").trim();
  return same.length < 2 ? [] : [first, ...same.filter((c) => c !== first)];
}

// By what a number in `from` is multiplied to be written in `to` (both labels of the same kind), or null.
export function ratio(from: string | undefined, to: string | undefined): number | null {
  const [a, b] = [parseUnit(from), parseUnit(to)];
  return a && b && sameDim(a.dim, b.dim) ? a.factor / b.factor : null;
}

const DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const superscript = (n: number) => (n === 1 ? "" : String(n).replace("-", "⁻").replace(/[0-9]/g, (d) => DIGITS[Number(d)]));

// A dimension written as SI units, for messages: m²·s⁻¹.
export function describeDim(dim: Dim): string {
  const names: Record<string, string> = { L: "m", M: "kg", T: "s" };
  const parts = Object.entries(dim)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([k, n]) => `${names[k] ?? k}${superscript(n)}`);
  return parts.length ? parts.join("·") : "a plain number";
}
