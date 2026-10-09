"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveScenario } from "@/app/actions/scenarios";
import type { Bundle } from "@/lib/boards";
import { compute, shownValues } from "@/lib/calculator";
import { displayName, formatNumber, parseValue, type Analysis } from "@/lib/formulas";
import { boardEvaluator, optimize, type OptimizeResult } from "@/lib/optimize";
import { SCENARIO_LIMITS, type ScenarioSnapshot } from "@/lib/scenarios";
import { CollapsibleSection } from "./ui/CollapsibleSection";

const MAX_VARIED = 6;

type Found = {
  result: OptimizeResult;
  snapshot: ScenarioSnapshot;
  shown: Record<string, string>;
  before: Record<string, string>;
  varied: string[];
  objective: string;
  constrained?: string;
};

// "Find the best": picks the settings of some variables, each within its range, that make a result as large or as
// small as possible, optionally while another result stays within a limit. The best settings can be put on the
// board or kept as a scenario.
export function OptimizerPanel({
  analysis,
  flat,
  values,
  locked,
  boardId,
  onApply,
}: {
  analysis: Analysis;
  flat: Bundle;
  values: Record<string, string>;
  locked: string[];
  /** Set for a signed-in user, so the best settings can be saved as a scenario. */
  boardId?: string;
  onApply: (snapshot: ScenarioSnapshot) => void;
}) {
  const router = useRouter();
  const label = (name: string) => flat.labels[name] || displayName(name);
  const visible = analysis.variables.filter((v) => flat.hidden[v.name] !== true);
  // Only variables with both a lowest and a highest value can be varied.
  const rangeable = visible.filter((v) => {
    const r = flat.ranges[v.name];
    return r?.min !== undefined && r.max !== undefined && r.max > r.min;
  });

  const [objective, setObjective] = useState("");
  const [maximize, setMaximize] = useState(true);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [limited, setLimited] = useState("");
  const [op, setOp] = useState<"<=" | ">=">("<=");
  const [limit, setLimit] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const target = objective || visible.find((v) => !rangeable.some((r) => r.name === v.name))?.name || visible[0]?.name || "";
  const varied = (picked ?? rangeable.map((v) => v.name)).filter((n) => n !== target && n !== limited && rangeable.some((v) => v.name === n)).slice(0, MAX_VARIED);
  const limitNumber = parseValue(limit);

  function run() {
    setMessage(null);
    setFound(null);
    setSaved(false);
    setSearching(true);
    // Let the button show "Searching…" before the search holds the page.
    setTimeout(() => {
      try {
        const bounds = Object.fromEntries(
          varied.map((n) => {
            const r = flat.ranges[n];
            const now = parseValue(values[n]);
            const mid = (r.min! + r.max!) / 2;
            return [n, { min: r.min!, max: r.max!, start: now === undefined ? mid : Math.min(r.max!, Math.max(r.min!, now)) }];
          }),
        );
        const constrained = limited && limitNumber !== undefined ? limited : undefined;
        const evaluate = boardEvaluator(analysis, values, locked, varied, target, constrained);
        const result = optimize({ bounds, evaluate, maximize, constraint: constrained ? { op, limit: limitNumber! } : undefined });
        if (!result) {
          setMessage("The board couldn't be solved for any settings in these ranges.");
          return;
        }
        const keep = locked.filter((n) => !varied.includes(n) && n !== target && n !== constrained);
        const lockedNow = [...varied, ...keep];
        const typed = { ...values, ...Object.fromEntries(varied.map((n) => [n, formatNumber(Number(result.x[n].toPrecision(6)))])) };
        const out = compute(analysis, typed, lockedNow);
        const now = compute(analysis, values, locked);
        setFound({
          result,
          snapshot: { values: out.display, locked: lockedNow },
          shown: shownValues(out.display, out.plan.held, flat.decimals),
          before: shownValues(now.display, now.plan.held, flat.decimals),
          varied,
          objective: target,
          constrained,
        });
        setName(`${maximize ? "Highest" : "Lowest"} ${label(target)}`.slice(0, SCENARIO_LIMITS.name));
      } finally {
        setSearching(false);
      }
    }, 20);
  }

  function keep() {
    if (!boardId || !found) return;
    start(async () => {
      const out = await saveScenario(boardId, name, found.snapshot);
      if (!out.ok) {
        setMessage(out.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const unit = (n: string) => (flat.units[n] ? ` ${flat.units[n]}` : "");
  const change = (n: string, f: Found) => `${f.before[n] ?? "?"} → ${f.shown[n] ?? "?"}${unit(n)}`;

  return (
    <CollapsibleSection
      title="Find the best"
      description="Choose a result to make as high or as low as possible, and the variables that may change (each needs a lowest and a highest value, set in the variable editor). Chalkwork searches those ranges for the best settings, and can keep a result within a limit. It finds a good answer, not a proven best one."
    >
      {rangeable.length === 0 ? (
        <p className="text-ink-muted">
          No variable on this board has both a lowest and a highest value yet. The owner can set them in the variable editor.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xl">
            <select value={maximize ? "max" : "min"} onChange={(e) => setMaximize(e.target.value === "max")} className="cursor-pointer bg-transparent" aria-label="Highest or lowest">
              <option value="max">Make the highest</option>
              <option value="min">Make the lowest</option>
            </select>
            <select value={target} onChange={(e) => setObjective(e.target.value)} className="cursor-pointer bg-transparent" aria-label="The result to improve">
              {visible.map((v) => (
                <option key={v.name} value={v.name}>
                  {label(v.name)}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="pb-1 text-lg text-ink-muted">by changing (up to {MAX_VARIED})</legend>
            {rangeable
              .filter((v) => v.name !== target)
              .map((v) => {
                const r = flat.ranges[v.name];
                const on = varied.includes(v.name);
                return (
                  <label key={v.name} className="flex items-baseline gap-2 text-xl">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && varied.length >= MAX_VARIED}
                      onChange={(e) => setPicked(e.target.checked ? [...varied, v.name] : varied.filter((n) => n !== v.name))}
                      className="h-5 w-5 accent-[var(--accent)]"
                    />
                    <span>{label(v.name)}</span>
                    <span className="text-base text-ink-muted">
                      {formatNumber(r.min!)} to {formatNumber(r.max!)}
                      {unit(v.name)}
                    </span>
                  </label>
                );
              })}
          </fieldset>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xl">
            <span className="text-ink-muted">while</span>
            <select value={limited} onChange={(e) => setLimited(e.target.value)} className="cursor-pointer bg-transparent" aria-label="A result to keep within a limit">
              <option value="">(no limit)</option>
              {visible
                .filter((v) => v.name !== target)
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {label(v.name)}
                  </option>
                ))}
            </select>
            {limited && (
              <>
                <select value={op} onChange={(e) => setOp(e.target.value as "<=" | ">=")} className="cursor-pointer bg-transparent" aria-label="At most or at least">
                  <option value="<=">is at most</option>
                  <option value=">=">is at least</option>
                </select>
                <input
                  className="field w-28 text-xl"
                  value={limit}
                  inputMode="decimal"
                  placeholder="limit"
                  onChange={(e) => setLimit(e.target.value.replace(/[^0-9.,eE+-]/g, ""))}
                  aria-label="The limit"
                />
              </>
            )}
          </div>

          <div>
            <button type="button" className="btn" disabled={searching || varied.length === 0 || !target || (limited !== "" && limitNumber === undefined)} onClick={run}>
              {searching ? "Searching…" : "Find the best"}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-danger">{message}</p>}

      {found && (
        <div className="sketch-box flex flex-col gap-3 px-4 py-3">
          {!found.result.feasible && (
            <p className="text-op">No settings in these ranges keep {label(found.constrained ?? "")} within the limit. These come closest.</p>
          )}
          <p className="text-xl">
            {maximize ? "Highest" : "Lowest"} {label(found.objective)} found: <strong>{found.shown[found.objective]}</strong>
            {unit(found.objective)} <span className="text-base text-ink-muted">(now {found.before[found.objective] ?? "?"})</span>
          </p>
          <ul className="flex flex-col gap-0.5 text-xl">
            {found.varied.map((n) => (
              <li key={n}>
                {label(n)} = {change(n, found)}
              </li>
            ))}
            {found.constrained && <li className="text-ink-muted">{label(found.constrained)} = {change(found.constrained, found)}</li>}
          </ul>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <button type="button" className="btn" onClick={() => onApply(found.snapshot)}>
              Put these on the board
            </button>
            {boardId && (
              <>
                <input className="field min-w-[10rem] flex-1 text-lg" value={name} maxLength={SCENARIO_LIMITS.name} onChange={(e) => setName(e.target.value)} aria-label="Name for the scenario" />
                <button type="button" className="link text-base" disabled={pending || !name.trim() || saved} onClick={keep}>
                  {saved ? "Saved as a scenario ✓" : "Save as a scenario"}
                </button>
              </>
            )}
          </div>
          <p className="text-base text-ink-muted">Searched {found.result.evaluations} combinations of settings. Other numbers you had typed stay as they are.</p>
        </div>
      )}
    </CollapsibleSection>
  );
}
