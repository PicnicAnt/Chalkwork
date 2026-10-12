// Numbers are kept and sent with a dot for decimals and no separators ("1234.5", or "1,234.5" where a variable is
// written with thousands separators). What people see and type follows their language: in Danish, 1.234,5. These
// helpers convert at the edge, so the maths and the saved boards don't change. Plain logic.

export type NumberLocale = { tag: string; decimal: string; group: string };

const cache = new Map<string, NumberLocale>();

export function numberLocale(tag = "en-US"): NumberLocale {
  const known = cache.get(tag);
  if (known) return known;
  let decimal = ".";
  let group = ",";
  let resolved = tag;
  try {
    const parts = new Intl.NumberFormat(tag).formatToParts(1234567.5);
    decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    group = parts.find((p) => p.type === "group")?.value ?? ",";
  } catch {
    resolved = "en-US";
  }
  const locale = { tag: resolved, decimal, group };
  cache.set(tag, locale);
  return locale;
}

// A number written the plain way, shown in the person's language: the dot becomes their decimal mark and a comma
// (thousands separator) becomes theirs. Anything that isn't a number is left as it is.
export function toLocaleText(text: string, locale: NumberLocale): string {
  if (locale.decimal === "." && locale.group === ",") return text;
  if (!/^-?[\d.,]+(e[+-]?\d+)?$/i.test(text.trim())) return text;
  return text.replace(/[.,]/g, (c) => (c === "." ? locale.decimal : locale.group));
}

// What was typed in the person's language, as the plain way of writing it. In a language that writes 1.234,5, a lone
// dot is taken as a decimal mark ("1.5") unless it only makes sense as a thousands separator ("1.234").
export function fromLocaleText(text: string, locale: NumberLocale): string {
  if (locale.decimal === ".") return text;
  const t = text.trim().replace(/[\s  ]/g, "");
  if (locale.decimal === ",") {
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return t.replace(/\./g, "").replace(",", ".");
    return t.replace(",", ".");
  }
  // Any other decimal mark: swap it for a dot and drop the group mark.
  return t.split(locale.group).join("").replace(locale.decimal, ".");
}

// Every number inside a longer text (a sentence, "+12.5%"): each run of digits with dots and commas is shown the
// person's way.
export function localizeNumbers(text: string, locale: NumberLocale): string {
  if (locale.decimal === "." && locale.group === ",") return text;
  return text.replace(/\d[\d.,]*\d|\d/g, (run) => toLocaleText(run, locale));
}
