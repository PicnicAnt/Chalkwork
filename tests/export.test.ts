import { describe, expect, it } from "vitest";
import { fileNameOf, toCsv } from "@/lib/export";

describe("exporting a table", () => {
  it("writes rows as CSV with a mark for spreadsheets", () => {
    expect(toCsv([["a", "b"], [1, 2.5]])).toBe("﻿a,b\r\n1,2.5\r\n");
  });

  it("quotes what needs it: commas, quotes, line breaks and semicolons", () => {
    expect(toCsv([['say "hi", then go', "two\nlines", "a;b"]])).toBe('﻿"say ""hi"", then go","two\nlines","a;b"\r\n');
  });

  it("leaves empty and missing cells empty, and keeps accents and units", () => {
    expect(toCsv([["Area (m²)", null, undefined, "µs"]])).toBe("﻿Area (m²),,,µs\r\n");
  });

  it("makes a file name from a title", () => {
    expect(fileNameOf("Path of Exile: DPS calculator")).toBe("path-of-exile-dps-calculator");
    expect(fileNameOf("Løn og skat")).toBe("lon-og-skat");
    expect(fileNameOf("!!!")).toBe("chalkwork");
  });
});
