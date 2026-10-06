"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createCalculation } from "@/app/actions";
import { LIMITS, splitFormulas } from "@/lib/calculation";
import { analyzeFormulas } from "@/lib/formulas";
import { rememberCalculation } from "@/lib/my-calculations";
import { CalculatorPanel } from "./CalculatorView";

const EXAMPLE = {
  title: "Loan payment",
  description: "Monthly payment for a fixed-rate loan.",
  formulas: [
    "monthly_rate = annual_rate_percent / 100 / 12",
    "payments = years * 12",
    "monthly_payment = loan_amount * monthly_rate / (1 - (1 + monthly_rate) ^ -payments)",
    "total_paid = monthly_payment * payments",
    "total_interest = total_paid - loan_amount",
  ].join("\n"),
  values: { annual_rate_percent: "4.5", years: "30", loan_amount: "250000" },
};


export function CalculationEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formulaText, setFormulaText] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const formulas = useMemo(() => splitFormulas(formulaText), [formulaText]);
  const analysis = useMemo(() => analyzeFormulas(formulas), [formulas]);

  function loadExample() {
    setTitle(EXAMPLE.title);
    setDescription(EXAMPLE.description);
    setFormulaText(EXAMPLE.formulas);
    setValues(EXAMPLE.values);
    setErrors([]);
  }

  function save() {
    startTransition(async () => {
      const result = await createCalculation({ title, description, formulas, values });
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      rememberCalculation({ id: result.id, title: result.title, createdAt: result.createdAt });
      router.push(`/c/${result.id}`);
    });
  }

  return (

    <form
      className="flex flex-col gap-10"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold sm:text-4xl">New calculation</h1>
          <button type="button" onClick={loadExample} className="link text-base">
            Fill in an example
          </button>
        </div>
        <input
          className="field sketch text-2xl"
          placeholder="Title, e.g. Loan payment"
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
        />
        <textarea
          className="field resize-none"
          placeholder="Description (optional)"
          rows={2}
          value={description}
          maxLength={LIMITS.description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Description"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold">Formulas</h2>
          <p className="text-base text-ink-muted">
            One per line, like <span className="text-accent-2">area = width * height</span>. Every name becomes a
            variable, and any variable can be changed: the others adjust so all formulas still hold. Supports + − ×
            ÷, ^, parentheses, and functions like sqrt, round, min, max.
          </p>
        </div>
        <textarea
          className="sketch-box field-sizing-content min-h-40 w-full resize-y bg-transparent px-4 py-3 text-xl leading-9 text-ink outline-none placeholder:text-ink-faint focus:border-accent"
          placeholder={"area = width * height\nprice = area * price_per_m2"}
          rows={Math.max(4, formulas.length + 1)}
          value={formulaText}
          onChange={(e) => setFormulaText(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Formulas"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold">Try it</h2>
          <p className="text-base text-ink-muted">
            Change any variable. Values you type get locked and the formulas never change them; everything
            unlocked is recalculated. Tap a lock to release it. These values are saved as what people see first.
          </p>
        </div>
        <CalculatorPanel analysis={analysis} values={values} onChange={setValues} />
      </section>

      {errors.length > 0 && (
        <ul className="sketch-box border-danger px-4 py-3 text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save and get share link"}
        </button>
      </div>
    </form>
  );
}