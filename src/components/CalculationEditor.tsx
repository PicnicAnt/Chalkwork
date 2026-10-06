"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createCalculation } from "@/app/actions";
import { LIMITS, splitFormulas } from "@/lib/calculation";
import { analyzeFormulas } from "@/lib/formulas";
import { rememberCalculation } from "@/lib/my-calculations";
import { CalculatorPanel } from "./CalculatorView";

// An ARPG damage sheet in the style of Path of Exile: weapon damage scaled by increased and more
// modifiers, attack speed, crit, and chance to hit. Written dps-first so it heads the list, and
// with inc_dmg appearing last, so typing a target dps solves for how much increased damage it takes.
const EXAMPLE = {
  title: "Attack DPS",
  description: "Path of Exile style damage per second for a melee attack: weapon damage, increased and more modifiers, attack speed, crit and accuracy.",
  formulas: [
    "dps = avg_hit * aps * crit_factor * hit_chance / 100",
    "hit_chance = min(max(125 * accuracy / (accuracy + (enemy_evasion / 5) ^ 0.9), 5), 100)",
    "crit_factor = 1 + crit_chance / 100 * (crit_multi / 100 - 1)",
    "crit_chance = min(base_crit * (1 + inc_crit / 100), 100)",
    "aps = base_aps * (1 + inc_aps / 100)",
    "avg_hit = (min_dmg + max_dmg) / 2 * (1 + more_dmg / 100) * (1 + inc_dmg / 100)",
  ].join("\n"),
  values: {
    accuracy: "2400",
    enemy_evasion: "12000",
    crit_multi: "380",
    base_crit: "6.5",
    inc_crit: "300",
    base_aps: "1.55",
    inc_aps: "32",
    min_dmg: "38",
    max_dmg: "115",
    more_dmg: "49",
    inc_dmg: "250",
  },
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