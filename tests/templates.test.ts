import { describe, expect, it } from "vitest";
import { validateDraft } from "@/lib/board-draft";
import { analyzeFormulas } from "@/lib/formulas";
import { compute, initialLocks } from "@/lib/calculator";
import { TEMPLATES } from "@/lib/templates";

describe("templates", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s is a board that can be saved", (_id, template) => {
    const { draft, errors } = validateDraft(template.draft);
    expect(errors).toEqual([]);
    expect(draft?.visualizations).toEqual(template.draft.visualizations);
  });

  it("has a short unique id each", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("the loan template gives a sensible payment, and can be turned around", () => {
    const loan = TEMPLATES.find((t) => t.id === "loan")!.draft;
    const analysis = analyzeFormulas(loan.formulas);
    const locks = initialLocks(analysis, loan.values);
    const out = compute(analysis, loan.values, locks);
    expect(Number(out.display.payment)).toBeCloseTo(1013.37, 1);
    // Fix the payment and the amount: the term follows (same loan, so about 360 months).
    const back = compute(analysis, { ...loan.values, payment: out.display.payment, months: "" }, ["principal", "annual_rate", "payment"]);
    expect(Number(back.display.months)).toBeCloseTo(360, 0);
  });
});
