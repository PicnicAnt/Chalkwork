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

const fieldClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/5";

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
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Details</h2>
          <button type="button" onClick={loadExample} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            Fill in an example
          </button>
        </div>
        <input
          className={fieldClass}
          placeholder="Title, e.g. Loan payment"
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
        />
        <textarea
          className={fieldClass}
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
          <h2 className="text-lg font-semibold">Formulas</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            One per line, like <code className="font-mono">area = width * height</code>. Every name becomes a
            variable, and any variable can be changed: the others adjust so all formulas still hold. Supports + − ×
            ÷, ^, parentheses, and functions like sqrt, round, min, max.
          </p>
        </div>
        <textarea
          className={`${fieldClass} font-mono text-sm leading-6`}
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

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Try it</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Change any variable. The ones you changed most recently stay put, and the rest are recalculated.
            These values are saved as what people see first.
          </p>
        </div>
        <CalculatorPanel analysis={analysis} values={values} onChange={setValues} />
      </section>

      {errors.length > 0 && (
        <ul className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save and get share link"}
        </button>
      </div>
    </form>
  );
}
