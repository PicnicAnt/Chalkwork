"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createCalculation } from "@/app/actions";
import { LIMITS, toVariableName, type CalcInput, type CalcOutput } from "@/lib/calculation";
import { evaluateCalculation } from "@/lib/evaluate";
import { rememberCalculation } from "@/lib/my-calculations";

const EXAMPLE = {
  title: "Loan payment",
  description: "Monthly payment for a fixed-rate loan.",
  inputs: [
    { label: "Loan amount", value: "250000" },
    { label: "Annual rate percent", value: "4.5" },
    { label: "Years", value: "30" },
  ],
  outputs: [
    { label: "Monthly rate", formula: "annual_rate_percent / 100 / 12" },
    { label: "Payments", formula: "years * 12" },
    { label: "Monthly payment", formula: "loan_amount * monthly_rate / (1 - (1 + monthly_rate) ^ -payments)" },
    { label: "Total paid", formula: "monthly_payment * payments" },
  ],
};

const fieldClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/5";

export function CalculationEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [inputs, setInputs] = useState<CalcInput[]>([{ label: "", value: "" }]);
  const [outputs, setOutputs] = useState<CalcOutput[]>([{ label: "", formula: "" }]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => evaluateCalculation(inputs, outputs), [inputs, outputs]);

  function loadExample() {
    setTitle(EXAMPLE.title);
    setDescription(EXAMPLE.description);
    setInputs(EXAMPLE.inputs);
    setOutputs(EXAMPLE.outputs);
    setErrors([]);
  }

  function save() {
    startTransition(async () => {
      const result = await createCalculation({ title, description, inputs, outputs });
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
          <h2 className="text-lg font-semibold">Inputs</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Values people can change. Each label becomes a name you can use in formulas.
          </p>
        </div>
        {inputs.map((input, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                className={fieldClass}
                placeholder="Label, e.g. Loan amount"
                value={input.label}
                maxLength={LIMITS.label}
                onChange={(e) => setInputs(inputs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                aria-label={`Input ${i + 1} label`}
              />
              <input
                className={`${fieldClass} max-w-40`}
                placeholder="Default value"
                value={input.value}
                maxLength={LIMITS.value}
                onChange={(e) => setInputs(inputs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                aria-label={`Input ${i + 1} default value`}
              />
              <RemoveButton onClick={() => setInputs(inputs.filter((_, j) => j !== i))} />
            </div>
            <VariableHint label={input.label} />
          </div>
        ))}
        <AddButton
          disabled={inputs.length >= LIMITS.inputs}
          onClick={() => setInputs([...inputs, { label: "", value: "" }])}
        >
          Add input
        </AddButton>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Formulas can use inputs and any result above them. Supports + − × ÷, ^, parentheses, and functions like
            sqrt, round, min, max.
          </p>
        </div>
        {outputs.map((output, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                className={`${fieldClass} max-w-56`}
                placeholder="Label, e.g. Total"
                value={output.label}
                maxLength={LIMITS.label}
                onChange={(e) => setOutputs(outputs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                aria-label={`Result ${i + 1} label`}
              />
              <input
                className={`${fieldClass} font-mono`}
                placeholder="Formula, e.g. price * quantity"
                value={output.formula}
                maxLength={LIMITS.formula}
                onChange={(e) => setOutputs(outputs.map((x, j) => (j === i ? { ...x, formula: e.target.value } : x)))}
                aria-label={`Result ${i + 1} formula`}
              />
              <RemoveButton onClick={() => setOutputs(outputs.filter((_, j) => j !== i))} />
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <VariableHint label={output.label} />
              <ResultPreview result={results[i]} />
            </div>
          </div>
        ))}
        <AddButton
          disabled={outputs.length >= LIMITS.outputs}
          onClick={() => setOutputs([...outputs, { label: "", formula: "" }])}
        >
          Add result
        </AddButton>
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

function VariableHint({ label }: { label: string }) {
  const name = toVariableName(label);
  if (!name) return <span />;
  return (
    <span className="text-xs text-black/50 dark:text-white/50">
      Use as <code className="rounded bg-black/5 px-1 font-mono dark:bg-white/10">{name}</code>
    </span>
  );
}

function ResultPreview({ result }: { result?: { value?: string; error?: string } }) {
  if (!result) return null;
  if (result.error) return <span className="truncate text-red-600 dark:text-red-400">{result.error}</span>;
  return <span className="font-mono font-medium">= {result.value}</span>;
}

function AddButton({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="self-start rounded-md border border-dashed border-black/25 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/25 dark:hover:bg-white/5"
    >
      + {children}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove row"
      className="shrink-0 rounded-md px-2 text-black/40 hover:bg-black/5 hover:text-black/80 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/80"
    >
      ✕
    </button>
  );
}
