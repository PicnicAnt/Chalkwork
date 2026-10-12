import { describe, expect, it } from "vitest";
import { fromLocaleText, localizeNumbers, numberLocale, toLocaleText } from "@/lib/locale";

const da = numberLocale("da-DK");
const en = numberLocale("en-US");
const de = numberLocale("de-CH");

describe("numbers in the person's language", () => {
  it("knows the decimal mark and the thousands separator of a language", () => {
    expect([da.decimal, da.group]).toEqual([",", "."]);
    expect([en.decimal, en.group]).toEqual([".", ","]);
    expect(numberLocale("not a language!").decimal).toBe(".");
  });

  it("shows plain numbers the Danish way, and leaves English alone", () => {
    expect(toLocaleText("1234.5", da)).toBe("1234,5");
    expect(toLocaleText("1,234,567.25", da)).toBe("1.234.567,25");
    expect(toLocaleText("1,234.5", en)).toBe("1,234.5");
    expect(toLocaleText("hello", da)).toBe("hello");
    expect(toLocaleText("?", da)).toBe("?");
  });

  it("reads what was typed in Danish as a plain number", () => {
    expect(fromLocaleText("1,5", da)).toBe("1.5");
    expect(fromLocaleText("1.234,5", da)).toBe("1234.5");
    expect(fromLocaleText("1.234", da)).toBe("1234");
    expect(fromLocaleText("1.5", da)).toBe("1.5");
    expect(fromLocaleText("-0,25", da)).toBe("-0.25");
    expect(fromLocaleText("1,5", en)).toBe("1,5");
  });

  it("round trips through any language", () => {
    for (const tag of ["da-DK", "de-DE", "fr-FR", "en-GB", "de-CH"]) {
      const loc = numberLocale(tag);
      for (const plain of ["0.5", "1234.5", "-87.25"]) {
        expect(fromLocaleText(toLocaleText(plain, loc), loc)).toBe(plain);
      }
    }
    expect(de.decimal).toBe(".");
  });

  it("changes every number in a text", () => {
    expect(localizeNumbers("+12.5% of 1,234.5", da)).toBe("+12,5% of 1.234,5");
    expect(localizeNumbers("a = 3", da)).toBe("a = 3");
  });
});
