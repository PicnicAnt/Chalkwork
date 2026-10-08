"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createCalculation, loadBoardToUse, updateCalculation } from "@/app/actions";
import {
  defaultAlias,
  dropAliasLinks,
  flatten,
  renameAliasInText,
  renameAliasKeys,
  renameAliasLinks,
  renameLinks,
  type IncludedBundle,
} from "@/lib/boards";
import { LIMITS, splitFormulas, type CalculationDraft } from "@/lib/calculation";
import { analyzeFormulas, displayName, formulaProblems } from "@/lib/formulas";
import { renameKey, renameVariableInText } from "@/lib/rename";
import { BoardsSection, type BoardChoice } from "./BoardsSection";
import { CalculatorPanel } from "./CalculatorView";
import { FormulaInput } from "./FormulaInput";
import { VariableEditor } from "./VariableEditor";

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
  labels: {
    dps: "DPS",
    avg_hit: "Average hit",
    aps: "Attack speed",
    crit_factor: "Crit factor",
    hit_chance: "Hit chance",
    accuracy: "Accuracy",
    enemy_evasion: "Enemy evasion",
    crit_chance: "Crit chance",
    crit_multi: "Crit multiplier",
    base_crit: "Base crit chance",
    inc_crit: "Increased crit chance",
    base_aps: "Base attack speed",
    inc_aps: "Increased attack speed",
    min_dmg: "Minimum damage",
    max_dmg: "Maximum damage",
    more_dmg: "More damage",
    inc_dmg: "Increased damage",
  } as Record<string, string>,
  decimals: {
    dps: "1",
    avg_hit: "1",
    aps: "2",
    crit_factor: "3",
    hit_chance: "1",
    crit_chance: "1",
  } as Record<string, string>,
  units: {
    dps: "dmg/s",
    aps: "/s",
    base_aps: "/s",
    hit_chance: "%",
    crit_chance: "%",
    base_crit: "%",
    inc_crit: "%",
    crit_multi: "%",
    inc_aps: "%",
    inc_dmg: "%",
    more_dmg: "%",
  },
  descriptions: {
    dps: "Damage per second against this enemy",
    avg_hit: "Average damage of one hit, before crits",
    aps: "Attacks per second",
    crit_factor: "Average damage multiplier from crits",
    hit_chance: "Chance to hit, from accuracy against evasion (%)",
    crit_chance: "Chance for a hit to crit (%)",
    base_aps: "Attack speed of the weapon",
    inc_aps: "Total increased attack speed (%)",
    inc_dmg: "Sum of all increased damage modifiers (%)",
    more_dmg: "Combined more damage multipliers (%)",
    inc_crit: "Total increased crit chance (%)",
    crit_multi: "Critical strike multiplier (%)",
  },
};

// Without `initial` this creates a new calculation. With `editing`, it saves changes to an
// existing one (which the signed-in user owns); with `initial` but no `editing`, it saves a new copy.
export function CalculationEditor({
  initial,
  editing,
  heading = "New calculation",
  availableBoards = [],
  initialIncluded = [],
}: {
  initial?: CalculationDraft;
  editing?: { id: string };
  heading?: string;
  /** Boards that can be added to this one. */
  availableBoards?: BoardChoice[];
  /** The boards `initial` already uses, loaded by the server. */
  initialIncluded?: IncludedBundle[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [formulaText, setFormulaText] = useState(initial?.formulas.join("\n") ?? "");
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initial?.descriptions ?? {});
  const [units, setUnits] = useState<Record<string, string>>(initial?.units ?? {});
  const [labels, setLabels] = useState<Record<string, string>>(initial?.labels ?? {});
  const [hidden, setHidden] = useState<Record<string, boolean>>(initial?.hidden ?? {});
  // Variables linked to another variable (this board's own links), by variable name.
  const [links, setLinks] = useState<Record<string, string>>(initial?.links ?? {});
  // Held as typed so the field can be emptied; turned into numbers when shown and saved.
  const [decimalText, setDecimalText] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial?.decimals ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const decimals = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(decimalText)
          .filter(([, text]) => text !== "")
          .map(([name, text]) => [name, Number(text)]),
      ),
    [decimalText],
  );
  // The boards this one uses, each loaded together with the boards it uses in turn.
  const [included, setIncluded] = useState<IncludedBundle[]>(initialIncluded);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [loadingBoard, startLoadingBoard] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const formulas = useMemo(() => splitFormulas(formulaText), [formulaText]);
  // This board and the boards it uses make up one system. What is set here wins over what a used
  // board says about its own variables.
  const flat = useMemo(
    () => flatten({ formulas, values, descriptions, units, labels, hidden, decimals, links }, included),
    [formulas, values, descriptions, units, labels, hidden, decimals, links, included],
  );
  const analysis = useMemo(() => analyzeFormulas(flat.bundle.formulas), [flat]);
  // Problems are numbered among this board's formulas. Line 0 is about a link or a board that is used.
  const problems = useMemo(() => {
    const linkList = Object.entries(links);
    return [
      ...flat.ownErrors.map((e) => ({ line: e.index + 1, message: e.message })),
      ...formulaProblems(analysis).map((p) => {
        if (p.line <= formulas.length) return p;
        const link = linkList[p.line - formulas.length - 1];
        return {
          line: 0,
          message: link
            ? `The link between ${displayName(link[0])} and ${displayName(link[1])}: ${p.message}`
            : `A formula from a board that is used: ${p.message}`,
        };
      }),
    ];
  }, [flat, analysis, formulas, links]);
  // The box also has blank lines, so problems are matched to the text lines that have something in them.
  const badLines = useMemo(() => {
    const textLines = formulaText.split("\n");
    const filled = textLines.flatMap((text, i) => (text.trim() ? [i] : []));
    return new Set(problems.filter((p) => p.line > 0).map((p) => filled[p.line - 1]));
  }, [formulaText, problems]);
  // board.variable names to suggest while typing a formula.
  const boardVariables = useMemo(
    () => analysis.variables.filter((v) => v.name.includes("$")).map((v) => displayName(v.name)),
    [analysis],
  );

  function addBoard(boardId: string) {
    setBoardError(null);
    startLoadingBoard(async () => {
      const result = await loadBoardToUse(boardId, editing?.id);
      if (!result.ok) {
        setBoardError(result.error);
        return;
      }
      setIncluded((list) => [
        ...list,
        {
          alias: defaultAlias(
            result.title,
            list.map((i) => i.alias),
          ),
          board: result.board,
          title: result.title,
          bundle: result.bundle,
        },
      ]);
    });
  }

  // A board goes by a new alias: formulas that mention it and the settings kept for its variables follow.
  function renameAlias(from: string, to: string) {
    setIncluded((list) => list.map((i) => (i.alias === from ? { ...i, alias: to } : i)));
    setFormulaText((text) => renameAliasInText(text, from, to));
    setValues((v) => renameAliasKeys(v, from, to));
    setDescriptions((d) => renameAliasKeys(d, from, to));
    setUnits((u) => renameAliasKeys(u, from, to));
    setLabels((l) => renameAliasKeys(l, from, to));
    setHidden((h) => renameAliasKeys(h, from, to));
    setDecimalText((d) => renameAliasKeys(d, from, to));
    setLinks((l) => renameAliasLinks(l, from, to));
  }

  function loadExample() {
    setTitle(EXAMPLE.title);
    setDescription(EXAMPLE.description);
    setFormulaText(EXAMPLE.formulas);
    setValues(EXAMPLE.values);
    setDescriptions(EXAMPLE.descriptions);
    setUnits(EXAMPLE.units);
    setLabels(EXAMPLE.labels);
    setHidden({});
    setDecimalText(EXAMPLE.decimals);
    setIncluded([]);
    setLinks({});
    setBoardError(null);
    setErrors([]);
  }

  // Renaming rewrites the formulas, and the starting value and note move to the new name.
  function renameVariable(from: string, to: string) {
    setFormulaText((text) => renameVariableInText(text, analysis, from, to));
    setValues((v) => renameKey(v, from, to));
    setDescriptions((d) => renameKey(d, from, to));
    setUnits((u) => renameKey(u, from, to));
    setLabels((l) => renameKey(l, from, to));
    setHidden((h) => renameKey(h, from, to));
    setDecimalText((d) => renameKey(d, from, to));
    setLinks((l) => renameLinks(l, from, to));
  }

  function save() {
    startTransition(async () => {
      const includes = included.map((i) => (i.name ? { board: i.board, alias: i.alias, name: i.name } : { board: i.board, alias: i.alias }));
      const draft = { title, description, formulas, values, descriptions, units, labels, hidden, decimals, includes, links };
      const result = editing
        ? await updateCalculation(editing.id, draft)
        : await createCalculation(draft);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
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
          <h1 className="text-3xl font-bold sm:text-4xl">{heading}</h1>
          {!initial && (
            <button type="button" onClick={loadExample} className="link text-base">
              Fill in an example
            </button>
          )}
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
        <FormulaInput
          value={formulaText}
          onChange={setFormulaText}
          placeholder={"area = width * height\nprice = area * price_per_m2"}
          badLines={badLines}
          extraNames={boardVariables}
        />
        {problems.length > 0 && (
          <ul className="flex flex-col gap-1 text-base text-danger">
            {problems.map((p) => (
              <li key={`${p.line}-${p.message}`}>
                {p.line > 0 && <span className="text-xl">{formulas[p.line - 1]} — </span>}
                {p.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <BoardsSection
        includes={included.map((i) => ({ board: i.board, alias: i.alias, name: i.name }))}
        included={included}
        available={availableBoards.filter((b) => b.id !== editing?.id)}
        busy={loadingBoard}
        error={boardError}
        onAdd={addBoard}
        onAlias={renameAlias}
        onName={(alias, name) => setIncluded((list) => list.map((i) => (i.alias === alias ? { ...i, name } : i)))}
        onRemove={(alias) => {
          setIncluded((list) => list.filter((i) => i.alias !== alias));
          setLinks((l) => dropAliasLinks(l, alias));
        }}
      />

      <VariableEditor
        analysis={analysis}
        groups={flat.bundle.groups}
        descriptions={flat.bundle.descriptions}
        units={flat.bundle.units}
        labels={flat.bundle.labels}
        hidden={flat.bundle.hidden}
        links={flat.bundle.links}
        ownLinks={links}
        decimals={Object.fromEntries(Object.entries(flat.bundle.decimals).map(([k, v]) => [k, String(v)]))}
        onRename={renameVariable}
        onDescribe={(name, text) => setDescriptions((d) => ({ ...d, [name]: text }))}
        onUnit={(name, unit) => setUnits((u) => ({ ...u, [name]: unit }))}
        onLabel={(name, text) => setLabels((l) => ({ ...l, [name]: text }))}
        onHide={(name, value) => setHidden((h) => ({ ...h, [name]: value }))}
        onLink={(name, target) =>
          setLinks((l) => {
            const { [name]: _removed, ...rest } = l;
            void _removed;
            return target ? { ...rest, [name]: target } : rest;
          })
        }
        onDecimals={(name, text) => setDecimalText((d) => ({ ...d, [name]: text }))}
      />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold">Try it</h2>
          <p className="text-base text-ink-muted">
            Change any variable. Values you type get locked and the formulas never change them; everything
            unlocked is recalculated. Tap a lock to release it. These values are saved as what people see first.
          </p>
        </div>
        <CalculatorPanel
          analysis={analysis}
          values={flat.bundle.values}
          onChange={setValues}
          descriptions={flat.bundle.descriptions}
          units={flat.bundle.units}
          labels={flat.bundle.labels}
          hidden={flat.bundle.hidden}
          links={flat.bundle.links}
          revealHidden
          decimals={flat.bundle.decimals}
          groups={flat.bundle.groups}
        />
      </section>

      {errors.length > 0 && (
        <ul className="sketch-box border-danger px-4 py-3 text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div>
        <button type="submit" disabled={pending || problems.length > 0} className="btn btn-primary">
          {pending ? "Saving…" : editing ? "Save changes" : "Save and get share link"}
        </button>
      </div>
    </form>
  );
}