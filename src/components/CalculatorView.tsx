"use client";

import { useMemo } from "react";
import { evaluateFormulas, type Analysis } from "@/lib/formulas";

// Inputs derived from the formulas on one side, every formula's live result on the other.
export function CalculatorPanel({
  analysis,
  values,
  onChange,
  onReset,
}: {
  analysis: Analysis;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onReset?: () => void;
}) {
  const results = useMemo(() => evaluateFormulas(analysis, values), [analysis, values]);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Inputs</h2>
          {onReset && (
            <button type="button" onClick={onReset} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Reset
            </button>
          )}
        </div>
        {analysis.inputs.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">
            No inputs. Any name a formula uses but doesn&apos;t define shows up here.
          </p>
        )}
        {analysis.inputs.map((input) => (
          <label key={input.name} className="flex flex-col gap-1 text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{input.label}</span>
              <code className="font-mono text-xs text-black/40 dark:text-white/40">{input.name}</code>
            </span>
            <input
              className="rounded-md border border-black/15 bg-white px-3 py-2 font-mono text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-white/15 dark:bg-white/5"
              inputMode="decimal"
              placeholder="Enter a value"
              value={values[input.name] ?? ""}
              onChange={(e) => onChange({ ...values, [input.name]: e.target.value })}
            />
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Results</h2>
        {results.length === 0 && <p className="text-sm text-black/50 dark:text-white/50">No formulas yet.</p>}
        {results.length > 0 && (
          <dl className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {results.map((result, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="min-w-0 text-sm">
                  {result.label}
                  <code className="mt-0.5 block break-words font-mono text-xs text-black/40 dark:text-white/40">
                    {result.text}
                  </code>
                </dt>
                <dd
                  className={
                    result.missing
                      ? "shrink-0 text-right text-sm text-black/40 dark:text-white/40"
                      : result.error
                        ? "shrink-0 text-right text-sm text-red-600 dark:text-red-400"
                        : "shrink-0 font-mono text-lg font-semibold"
                  }
                >
                  {result.error ?? result.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
