"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createBoard, loadBoardsUsed, loadBoardToUse, updateBoard } from "@/app/actions/boards";
import { reviseBoard, type ReviseOutcome } from "@/app/actions/ai";
import { MAX_PRESETS, SCENARIO_LIMITS, type Preset } from "@/lib/scenarios";
import { parseTable } from "@/lib/preset-import";
import { CHECK_LIMITS, runCheck, type Check } from "@/lib/checks";
import { ChecksList } from "./ChecksList";
import { compute, initialLocks } from "@/lib/calculator";
import { createSuggestion } from "@/app/actions/suggestions";
import {
  checkAlias,
  defaultAlias,
  flatten,
  renameAliasInText,
  renameAliasKeys,
  type IncludedBundle,
} from "@/lib/boards";
import { includeOf, LIMITS, splitFormulas, validateDraft, type BoardDraft } from "@/lib/board-draft";
import { saveLocalBoard } from "@/lib/local-boards";
import { analyzeFormulas, displayName, formulaProblems, parseValue } from "@/lib/formulas";
import type { Choice, Range, VarFormat, VarType } from "@/lib/boards";
import { checkUnits } from "@/lib/unit-check";
import { parseTags } from "@/lib/tags";
import { fromLocaleText, toLocaleText } from "@/lib/locale";
import { useNumberLocale } from "./useNumberLocale";
import { VISIBILITIES, type Visibility } from "@/lib/visibility";
import { checkVariableName, renameKey, renameVariableInText } from "@/lib/rename";
import { BoardRow, type BoardChoice } from "./BoardsSection";
import { AddVariable, type VariableKind } from "./AddVariable";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { useFold } from "./ui/Foldable";
import { VisualizationEditor } from "./VisualizationEditor";
import { dropFromVisualizations, renameInVisualizations, type Visualization } from "@/lib/visualizations";
import { CalculatorPanel } from "./CalculatorView";
import { FormulaInput } from "./FormulaInput";
import { VariableEditor } from "./VariableEditor";
import { TryItems } from "./TryItems";
import { ImageField } from "./ImageField";
import { ReservedWords } from "./ReservedWords";
import { readTableDrafts, tableItems, type TableDraft } from "./TablesEditor";
import { collectionItems, collectionsOf, type CollectionDraft } from "./CollectionsEditor";
import { rowsToText } from "@/lib/tables";

// Without `initial` this creates a new calculation. With `editing`, it saves changes to an
// existing one (which the signed-in user owns); with `initial` but no `editing`, it saves a new copy.
type EditorProps = {
  initial?: BoardDraft;
  editing?: { id: string };
  /** Set when the board is someone else's: saving sends the owner a suggestion instead of saving. */
  suggesting?: { boardId: string };
  heading?: string;
  /** Boards that can be added to this one. */
  availableBoards?: BoardChoice[];
  /** The boards `initial` already uses, loaded by the server. */
  initialIncluded?: IncludedBundle[];
  /** The picture of the board being copied, as a data URL, which the copy starts with. */
  initialImage?: string;
  /** Set for a board kept on this device (made without signing in): it is saved there, not on the server. */
  local?: { id?: string };
  /** The checks the board has, which a copy starts with. */
  initialChecks?: Check[];
  /** Where the current picture of the board being edited can be shown from. */
  currentImageSrc?: string;
  /** Show "Ask for a change", which has the writing helper change the board as asked. */
  aiEnabled?: boolean;
};

type Applied = { n: number; draft: BoardDraft | undefined; included: IncludedBundle[] | undefined; changes: string[]; before: { draft: BoardDraft; included: IncludedBundle[] } | null };

// The editor. When the writing helper changes the board, the editor is started again from the changed board, with a
// list of what changed and a way back to what it was. Nothing is saved until the person saves.
type Snapshot = { draft: BoardDraft; included: IncludedBundle[] };
const MAX_STEPS = 50;
const DRAFT_DAYS = 14;

export function BoardEditor(props: EditorProps) {
  const [applied, setApplied] = useState<Applied | null>(null);
  // Every state the editor has been in (when typing paused), to step back and forward through, and the draft kept in
  // the browser so a closed tab or a lost connection doesn't lose it.
  const steps = useRef<Snapshot[]>([]);
  const at = useRef(0);
  const restoring = useRef(false);
  // Where the editor is among its steps, kept in state so the buttons follow it.
  const [nav, setNav] = useState({ at: 0, len: 0 });
  const sync = () => setNav({ at: at.current, len: steps.current.length });
  const [kept, setKept] = useState<{ draft: BoardDraft; savedAt: string } | null>(null);
  const draftKey = `chalkwork:draft:${props.local ? `local:${props.local.id ?? "new"}` : (props.editing?.id ?? (props.suggesting ? `suggest:${props.suggesting.boardId}` : "new"))}`;

  const read = (): { draft: BoardDraft; savedAt: string } | null => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { draft?: BoardDraft; savedAt?: string };
      if (!parsed.draft || !parsed.savedAt) return null;
      if (Date.now() - new Date(parsed.savedAt).getTime() > DRAFT_DAYS * 86_400_000) return null;
      return { draft: parsed.draft, savedAt: parsed.savedAt };
    } catch {
      return null;
    }
  };

  function onSnapshot(snap: Snapshot) {
    const list = steps.current;
    const text = JSON.stringify(snap.draft);
    if (list.length === 0) {
      list.push(snap);
      at.current = 0;
      // A draft kept earlier that differs from where the editor starts is offered back.
      const found = read();
      if (found && JSON.stringify(found.draft) !== text) setKept(found);
      sync();
      return;
    }
    if (restoring.current) {
      // The editor was started again from a step: that is the step now, whatever small tidying it did.
      restoring.current = false;
      list[at.current] = snap;
    } else if (JSON.stringify(list[at.current].draft) === text) {
      return;
    } else {
      list.splice(at.current + 1);
      list.push(snap);
      if (list.length > MAX_STEPS) list.shift();
      at.current = list.length - 1;
    }
    sync();
    try {
      if (JSON.stringify(list[0].draft) === text) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ draft: snap.draft, savedAt: new Date().toISOString() }));
    } catch {
      // A full or blocked store only means no kept draft.
    }
  }

  function go(to: number) {
    const target = steps.current[to];
    if (!target) return;
    at.current = to;
    restoring.current = true;
    setApplied((a) => ({ n: (a?.n ?? 0) + 1, draft: target.draft, included: target.included, changes: [], before: null }));
    sync();
  }

  async function restoreKept() {
    if (!kept) return;
    // A board kept on this device uses no other boards, so there is nothing to load for it.
    const out = kept.draft.includes.length === 0 ? { ok: true as const, included: [] } : await loadBoardsUsed(kept.draft.includes, props.editing?.id ?? props.suggesting?.boardId);
    if (!out.ok) {
      setKept(null);
      return;
    }
    restoring.current = false;
    setApplied((a) => ({ n: (a?.n ?? 0) + 1, draft: kept.draft, included: out.included, changes: [], before: null }));
    setKept(null);
  }

  // Ctrl+Z and Ctrl+Y step through the editor's states when the cursor isn't in a field (a field has its own undo).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey && at.current > 0) {
        e.preventDefault();
        go(at.current - 1);
      } else if ((k === "y" || (k === "z" && e.shiftKey)) && at.current < steps.current.length - 1) {
        e.preventDefault();
        go(at.current + 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // go only uses refs and state setters, so it is safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The picture is kept here so that the helper changing the board doesn't lose it.
  const [image, setImage] = useState(props.initialImage ?? "");
  const [imageTouched, setImageTouched] = useState(false);
  // The checks are kept here too, for the same reason.
  const [checks, setChecks] = useState<Check[]>(props.initialChecks ?? []);
  const canUndo = nav.at > 0;
  const canRedo = nav.at < nav.len - 1;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-lg">
        <button type="button" className="link disabled:opacity-40" disabled={!canUndo} onClick={() => go(nav.at - 1)} title="Step back (Ctrl+Z when the cursor is not in a field)">
          Undo
        </button>
        <button type="button" className="link disabled:opacity-40" disabled={!canRedo} onClick={() => go(nav.at + 1)} title="Step forward (Ctrl+Y)">
          Redo
        </button>
      </div>
      {props.local && (
        <p className="sketch-box mb-4 px-4 py-3 text-lg text-ink-muted">
          This board is kept on this device only. Sign in to save boards to an account, share them and use other boards.
        </p>
      )}
      {kept && (
        <div className="sketch-box mb-6 flex flex-col gap-2 px-4 py-3">
          <p className="text-xl">There is an unsaved draft of this from {new Date(kept.savedAt).toLocaleString("en-GB")}.</p>
          <div className="flex gap-4">
            <button type="button" className="btn" onClick={restoreKept}>
              Open the draft
            </button>
            <button
              type="button"
              className="link text-base"
              onClick={() => {
                try {
                  localStorage.removeItem(draftKey);
                } catch {
                  // Nothing was kept that could be removed.
                }
                setKept(null);
              }}
            >
              Throw it away
            </button>
          </div>
        </div>
      )}
      {applied && applied.changes.length > 0 && (
        <div className="sketch-box mb-6 flex flex-col gap-2 px-4 py-3">
          <p className="text-xl">The helper changed the board. Nothing is saved until you save.</p>
          <ul className="list-disc pl-6 text-base text-ink-muted">
            {applied.changes.slice(0, 12).map((c) => (
              <li key={c}>{c}</li>
            ))}
            {applied.changes.length > 12 && <li>…and {applied.changes.length - 12} more</li>}
          </ul>
          {applied.before && (
            <div>
              <button
                type="button"
                className="link text-base"
                onClick={() => {
                  const before = applied.before!;
                  setApplied({ n: applied.n + 1, draft: before.draft, included: before.included, changes: [], before: null });
                }}
              >
                Go back to how it was
              </button>
            </div>
          )}
        </div>
      )}
      <BoardEditorInner
        key={applied?.n ?? 0}
        {...props}
        initial={applied?.draft ?? props.initial}
        initialIncluded={applied?.included ?? props.initialIncluded}
        image={image}
        // A saved board keeps its picture unless it was changed here; a new board or a copy takes the one shown.
        imageToSend={props.editing ? (imageTouched ? image : undefined) : image}
        onImage={(next) => {
          setImage(next);
          setImageTouched(true);
        }}
        checks={checks}
        onChecks={setChecks}
        onSnapshot={onSnapshot}
        onSaved={() => {
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // Nothing was kept that could be removed.
          }
        }}
        onRevised={(out, before) => setApplied({ n: (applied?.n ?? 0) + 1, draft: out.draft, included: out.included, changes: out.changes, before })}
      />
    </>
  );
}

function BoardEditorInner({
  initial,
  editing,
  suggesting,
  heading = "New board",
  availableBoards = [],
  initialIncluded = [],
  aiEnabled = false,
  currentImageSrc,
  image,
  imageToSend,
  onImage,
  local,
  checks,
  onChecks,
  onSnapshot,
  onSaved,
  onRevised,
}: EditorProps & { checks: Check[]; onChecks: (checks: Check[]) => void; image: string; imageToSend: string | undefined; onImage: (image: string) => void; onSnapshot: (snap: Snapshot) => void; onSaved: () => void; onRevised: (out: Extract<ReviseOutcome, { ok: true }>, before: { draft: BoardDraft; included: IncludedBundle[] }) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tagText, setTagText] = useState((initial?.tags ?? []).join(", "));
  // Who can open the board.
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "public");
  const [formulaText, setFormulaText] = useState(initial?.formulas.join("\n") ?? "");
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initial?.descriptions ?? {});
  const [units, setUnits] = useState<Record<string, string>>(initial?.units ?? {});
  const [labels, setLabels] = useState<Record<string, string>>(initial?.labels ?? {});
  const [hidden, setHidden] = useState<Record<string, boolean>>(initial?.hidden ?? {});
  // Drawings of this board that follow its variables (those of used boards come with them).
  const [visualizations, setVisualizations] = useState<Visualization[]>(initial?.visualizations ?? []);
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
  // Numbers typed here are read the way the person's language writes them.
  const numLocale = useNumberLocale();
  // Min and max per variable, held as typed so the fields can be emptied.
  const [rangeText, setRangeText] = useState<Record<string, { min: string; max: string }>>(
    Object.fromEntries(Object.entries(initial?.ranges ?? {}).map(([k, r]) => [k, { min: r.min === undefined ? "" : String(r.min), max: r.max === undefined ? "" : String(r.max) }])),
  );
  const ranges = useMemo(() => {
    const out: Record<string, Range> = {};
    for (const [name, text] of Object.entries(rangeText)) {
      const min = parseValue(fromLocaleText(text.min, numLocale));
      const max = parseValue(fromLocaleText(text.max, numLocale));
      if (min !== undefined || max !== undefined) out[name] = { ...(min !== undefined && { min }), ...(max !== undefined && { max }) };
    }
    return out;
  }, [rangeText, numLocale]);
  // Presets: scenarios saved on the board for everyone to use. `locks` is what the panel last said was locked.
  const [presets, setPresets] = useState<Preset[]>(initial?.presets ?? []);
  const [presetName, setPresetName] = useState("");
  const [tableText, setTableText] = useState("");
  const [tableNote, setTableNote] = useState<string | null>(null);
  const [locks, setLocks] = useState<string[] | null>(null);
  const [loadedLocks, setLoadedLocks] = useState<string[] | undefined>(undefined);
  const [panelKey, setPanelKey] = useState(0);
  // Collections of items, held as typed.
  const [collectionDrafts, setCollectionDrafts] = useState<CollectionDraft[]>(() =>
    (initial?.collections ?? []).map((c) => ({ name: c.name, boards: c.boards ?? [] })),
  );
  const collections = useMemo(() => collectionsOf(collectionDrafts), [collectionDrafts]);
  // The options of choice variables, held as typed ("Easy = 1" per line).
  const [choiceText, setChoiceText] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial?.choices ?? {}).map(([k, list]) => [k, list.map((o) => `${o.label} = ${o.value}`).join("\n")])),
  );
  const choices = useMemo(() => {
    const out: Record<string, Choice[]> = {};
    for (const [name, text] of Object.entries(choiceText)) {
      const list: Choice[] = [];
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*(.+?)\s*[=:]\s*(-?[\d.,]+(?:e[+-]?\d+)?)\s*$/i.exec(line);
        const value = m ? parseValue(m[2]) : undefined;
        if (m && value !== undefined && !list.some((o) => o.label === m[1])) list.push({ label: m[1], value });
      }
      if (list.length > 0) out[name] = list;
    }
    return out;
  }, [choiceText]);
  // How each number is written (not listed: the default format).
  const [formats, setFormats] = useState<Record<string, VarFormat>>(initial?.formats ?? {});
  // What each variable holds: a number (not listed) or a yes/no.
  const [types, setTypes] = useState<Record<string, VarType>>(initial?.types ?? {});
  // The order variables are listed in (by name).
  const [order, setOrder] = useState<string[]>(initial?.order ?? []);
  // Lookup tables, held as typed (the rows are text until they are read).
  const [tableDrafts, setTableDrafts] = useState<TableDraft[]>(() =>
    (initial?.tables ?? []).map((t) => ({ name: t.name, mode: t.mode, text: rowsToText(t.rows) })),
  );
  const { tables, problems: tableProblems } = useMemo(() => readTableDrafts(tableDrafts), [tableDrafts]);
  // The boards this one uses, each loaded together with the boards it uses in turn.
  const [included, setIncluded] = useState<IncludedBundle[]>(initialIncluded);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [loadingBoard, startLoadingBoard] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  // What a suggestion is about, shown to the owner with it.
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const formulas = useMemo(() => splitFormulas(formulaText), [formulaText]);
  // This board and the boards it uses make up one system. What is set here wins over what a used
  // board says about its own variables.
  // Boards added to a collection just to try it out (not saved): they join the system after the boards that are used.
  const [tryItems, setTryItems] = useState<(IncludedBundle & { group: string })[]>([]);
  const liveTryItems = useMemo(() => tryItems.filter((t) => collections.some((c) => c.name === t.group)), [tryItems, collections]);
  const flat = useMemo(
    () => flatten({ formulas, values, descriptions, units, labels, hidden, decimals, ranges, tables, order, collections, types, formats, choices, visualizations }, [...included, ...liveTryItems]),
    [formulas, values, descriptions, units, labels, hidden, decimals, ranges, tables, order, collections, types, formats, choices, visualizations, included, liveTryItems],
  );
  const analysis = useMemo(() => analyzeFormulas(flat.bundle.formulas, flat.bundle.tables), [flat]);
  // Problems are numbered among this board's formulas. Line 0 is about a board that is used.
  const problems = useMemo(
    () => [
      ...flat.ownErrors.map((e) => ({ line: e.index + 1, message: e.message })),
      ...formulaProblems(analysis).map((p) =>
        p.line <= formulas.length ? p : { line: 0, message: `A formula from a board that is used: ${p.message}` },
      ),
    ],
    [flat, analysis, formulas],
  );
  // The box also has blank lines, so problems are matched to the text lines that have something in them.
  const badLines = useMemo(() => {
    const textLines = formulaText.split("\n");
    const filled = textLines.flatMap((text, i) => (text.trim() ? [i] : []));
    return new Set(problems.filter((p) => p.line > 0).map((p) => filled[p.line - 1]));
  }, [formulaText, problems]);
  // Formulas whose units don't fit. They are warnings: the board can still be saved.
  const unitWarnings = useMemo(() => checkUnits(analysis, flat.bundle.units), [analysis, flat]);
  // board.variable names to suggest while typing a formula.
  const boardVariables = useMemo(
    () => analysis.variables.filter((v) => v.name.includes("$")).map((v) => displayName(v.name)),
    [analysis],
  );

  // "Add variable": a number or yes/no is a new variable of the formulas (a line that is only its name), and a table,
  // collection or board is a variable of that type.
  const typedFold = useFold();
  function addVariable(kind: VariableKind, rawName: string, boardId?: string, allowed?: string[], preset?: string): string | null {
    const name = rawName.trim();
    if (kind === "board") {
      if (boardId) addBoard(boardId, undefined, preset);
      return null;
    }
    const taken = new Set([...tableDrafts.map((t) => t.name), ...collectionDrafts.map((c) => c.name.trim()), ...included.map((i) => i.alias)]);
    if (taken.has(name)) return `"${name}" is already used by a table, a collection or a board`;
    if (kind === "number" || kind === "boolean") {
      const problem = checkVariableName(name, "", analysis);
      if (problem) return problem;
      setFormulaText((text) => (text.trim() ? `${text.trimEnd()}\n${name}` : name));
      if (kind === "boolean") setTypes((t) => ({ ...t, [name]: "boolean" }));
      return null;
    }
    const problem = checkAlias(name) ?? (analysis.variables.some((v) => v.name === name) ? `"${name}" is already used by another variable` : null);
    if (problem) return problem;
    if (kind === "table") {
      setTableDrafts((list) => [...list, { name, mode: "step", text: "" }]);
      typedFold.open(`table:${tableDrafts.length}`);
    } else if (kind === "collection") {
      setCollectionDrafts((list) => [...list, { name, boards: allowed ?? [] }]);
      typedFold.open(`collection:${collectionDrafts.length}`);
    } else if (boardId) {
      addBoard(boardId, undefined, preset);
    }
    return null;
  }

  function addBoard(boardId: string, alias?: string, preset?: string) {
    setBoardError(null);
    startLoadingBoard(async () => {
      const result = await loadBoardToUse(boardId, editing?.id ?? suggesting?.boardId);
      if (!result.ok) {
        setBoardError(result.error);
        return;
      }
      setIncluded((list) => [
        ...list,
        {
          alias:
            alias ??
            defaultAlias(
              result.title,
              list.map((i) => i.alias),
            ),
          board: result.board,
          title: result.title,
          latest: result.latest,
          bundle: result.bundle,
          presetValues: result.presetValues,
          ...(preset ? { preset } : {}),
        },
      ]);
    });
  }

  function addTryItem(group: string, boardId: string, preset?: string) {
    setBoardError(null);
    startLoadingBoard(async () => {
      const result = await loadBoardToUse(boardId, editing?.id ?? suggesting?.boardId);
      if (!result.ok) {
        setBoardError(result.error);
        return;
      }
      setTryItems((list) => {
        const taken = new Set([...included.map((i) => i.alias), ...list.map((t) => t.alias)]);
        let n = 1;
        while (taken.has(`item${n}`)) n++;
        return [...list, { alias: `item${n}`, board: result.board, title: result.title, latest: result.latest, bundle: result.bundle, presetValues: result.presetValues, group, ...(preset ? { preset } : {}) }];
      });
    });
  }

  // A used board is pinned to a version, or follows the latest again: its formulas are loaded as that version had them.
  function pinBoard(alias: string, version: number | undefined) {
    const item = included.find((i) => i.alias === alias);
    if (!item) return;
    setBoardError(null);
    startLoadingBoard(async () => {
      const result = await loadBoardToUse(item.board, editing?.id ?? suggesting?.boardId, version);
      if (!result.ok) {
        setBoardError(result.error);
        return;
      }
      setIncluded((list) => list.map((i) => (i.alias === alias ? { ...i, version, latest: result.latest, bundle: result.bundle, presetValues: result.presetValues } : i)));
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
    // Drawings that read a variable of that board follow it.
    setVisualizations((vs) => renameInVisualizations(vs, (name) => (name.startsWith(from + "$") ? to + name.slice(from.length) : name)));
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
    setRangeText((r) => renameKey(r, from, to));
    setTypes((t) => renameKey(t, from, to));
    setFormats((f) => renameKey(f, from, to));
    setChoiceText((c) => renameKey(c, from, to));
    setOrder((o) => o.map((n) => (n === from ? to : n)));
    setVisualizations((vs) => renameInVisualizations(vs, (name) => (name === from ? to : name)));
  }

  // What the editor holds now, as a draft.
  const currentDraft = () => ({ title, description, formulas, values, descriptions, units, labels, hidden, decimals, ranges, tables, order, collections, presets, types, formats, choices, visibility, tags: parseTags(tagText), includes: included.map(includeOf), visualizations });

  // The writing helper changes the board as asked; the editor then starts again from the result.
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, aiStart] = useTransition();
  // The state of the editor, reported when typing pauses, for the steps back and forward and the kept draft.
  const stateText = JSON.stringify(currentDraft());
  const includedNow = useRef(included);
  const reportRef = useRef(onSnapshot);
  useEffect(() => {
    includedNow.current = included;
    reportRef.current = onSnapshot;
  });
  useEffect(() => {
    const wait = setTimeout(() => reportRef.current({ draft: JSON.parse(stateText) as BoardDraft, included: includedNow.current }), 700);
    return () => clearTimeout(wait);
  }, [stateText]);

  // Each check is run against the board as it is in the editor now.
  const checkResults = useMemo(() => checks.map((c) => runCheck(analysis, flat.bundle.values, c)), [checks, analysis, flat]);
  const [checkName, setCheckName] = useState("");

  // The numbers on screen as a check: what is locked is put in, and the other results are what is expected.
  function saveCheck() {
    const set: Record<string, string> = {};
    const expect: Record<string, string> = {};
    const lockedNow = locks ?? initialLocks(analysis, flat.bundle.values);
    // What the board works out from the locked numbers, whether or not the panel has shown it yet.
    const worked = compute(analysis, flat.bundle.values, lockedNow).display;
    for (const v of analysis.variables) {
      const value = lockedNow.includes(v.name) ? flat.bundle.values[v.name] : worked[v.name];
      const n = parseValue(value ?? "");
      if (n === undefined) continue;
      if (lockedNow.includes(v.name)) set[v.name] = value;
      else if (flat.bundle.hidden[v.name] !== true) expect[v.name] = String(Number(n.toPrecision(6)));
    }
    if (Object.keys(set).length === 0 || Object.keys(expect).length === 0) return;
    const name = checkName.trim().replace(/\s+/g, " ").slice(0, CHECK_LIMITS.name);
    onChecks([...checks.filter((c) => c.name !== name), { name, set, expect }].slice(0, CHECK_LIMITS.checks));
    setCheckName("");
  }

  function askHelper() {
    setAiError(null);
    aiStart(async () => {
      const before = currentDraft();
      const out = await reviseBoard(editing?.id ?? suggesting?.boardId ?? null, before, aiText);
      if (!out.ok) {
        setAiError(out.error);
        return;
      }
      onRevised(out, { draft: before as BoardDraft, included });
    });
  }

  function save() {
    startTransition(async () => {
      const includes = included.map(includeOf);
      const draft = { title, description, formulas, values, descriptions, units, labels, hidden, decimals, ranges, tables, order, collections, presets, types, formats, choices, visibility, tags: parseTags(tagText), includes, visualizations };
      if (suggesting) {
        const sent = await createSuggestion(suggesting.boardId, draft, message);
        if (!sent.ok) {
          setErrors(sent.errors);
          return;
        }
        onSaved();
        router.push(`/c/${suggesting.boardId}/suggestions/${sent.id}`);
        return;
      }
      if (local) {
        // Made without signing in: checked here, and kept in this browser.
        const checked = validateDraft(draft, []);
        if (!checked.draft) {
          setErrors(checked.errors);
          return;
        }
        try {
          const saved = saveLocalBoard({ id: local.id, draft: checked.draft, image: image, checks });
          onSaved();
          router.push(`/local/${saved.id}`);
        } catch {
          setErrors(["This browser has no room left to keep the board. Delete a board or a picture and try again."]);
        }
        return;
      }
      const result = editing
        ? await updateBoard(editing.id, draft, imageToSend, checks)
        : await createBoard(draft, imageToSend, checks);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      onSaved();
      router.push(`/c/${result.id}`);
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold sm:text-4xl">{heading}</h1>
          {!initial && !editing && !suggesting && (
            <Link href="/new" className="link text-base">
              Start from a template
            </Link>
          )}
        </div>
      </section>

      <CollapsibleSection title="About" description="The name, the description, the tags that make the board easy to find, and who can open it.">
        <input
          className="field sketch text-2xl"
          placeholder="Title, e.g. Loan payment"
          value={title}
          maxLength={LIMITS.title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
        />
        <ImageField
          value={image}
          currentSrc={currentImageSrc}
          onChange={onImage}
          aiEnabled={aiEnabled}
          describe={() => ({ title, description, formulas })}
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
        <input
          className="field text-lg"
          placeholder="Tags, separated by commas (optional), e.g. finance, loan"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          aria-label="Tags"
          autoCapitalize="off"
          spellCheck={false}
        />
        <label className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg text-ink-muted">
          Who can open it
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className="cursor-pointer bg-transparent text-xl text-ink" aria-label="Who can open the board">
            {VISIBILITIES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <span className="text-base">{VISIBILITIES.find((v) => v.value === visibility)?.hint}</span>
        </label>
      </CollapsibleSection>

      {aiEnabled && (
        // Not a form of its own: the editor is one form already, and forms can't be nested.
        <CollapsibleSection title="Ask for a change" description={'Say what to change in a sentence, such as “add a 20% VAT and show the price with it” or “use the Rectangle board for the base and add a Box drawing”. An AI model changes this board; you see what changed and can go back before you save.'}>
          <textarea
            id="ai-change"
            className="field w-full text-xl"
            rows={2}
            maxLength={500}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && aiText.trim() && !aiPending) askHelper();
            }}
            placeholder="What should be different?"
            aria-label="What should be different?"
          />
          <div className="flex flex-wrap items-baseline gap-3">
            <button type="button" className="btn" disabled={aiPending || !aiText.trim()} onClick={askHelper}>
              {aiPending ? "Changing…" : "Make the change"}
            </button>
            {aiError && <span className="text-danger">{aiError}</span>}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Formulas"
        count={formulas.length}
        description={
          <>
            One per line, like <span className="text-accent-2">area = width * height</span>. Any variable can be changed and the others adjust so all formulas still hold. An equation such as <span className="text-accent-2">3 * x + 4 = 19</span> works too: x is found.
          </>
        }
      >
        <FormulaInput
          value={formulaText}
          onChange={setFormulaText}
          placeholder={"area = width * height\nprice = area * price_per_m2"}
          badLines={badLines}
          extraNames={boardVariables}
        />
        {unitWarnings.length > 0 && (
          <ul className="flex flex-col gap-1 text-base text-accent" aria-label="Unit warnings">
            {unitWarnings.map((w) => (
              <li key={`${w.line}-${w.message}`}>
                <span className="text-xl">{w.formula} — </span>
                {w.message}
              </li>
            ))}
          </ul>
        )}
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
        <ReservedWords />
      </CollapsibleSection>

      <VariableEditor
        analysis={analysis}
        groups={flat.bundle.groups}
        descriptions={flat.bundle.descriptions}
        units={flat.bundle.units}
        labels={flat.bundle.labels}
        hidden={flat.bundle.hidden}
        decimals={Object.fromEntries(Object.entries(flat.bundle.decimals).map(([k, v]) => [k, String(v)]))}
        onRename={renameVariable}
        onDescribe={(name, text) => setDescriptions((d) => ({ ...d, [name]: text }))}
        onUnit={(name, unit) => setUnits((u) => ({ ...u, [name]: unit }))}
        onLabel={(name, text) => setLabels((l) => ({ ...l, [name]: text }))}
        onHide={(name, value) => setHidden((h) => ({ ...h, [name]: value }))}
        onDecimals={(name, text) => setDecimalText((d) => ({ ...d, [name]: text }))}
        order={flat.bundle.order}
        types={flat.bundle.types}
        formats={flat.bundle.formats}
        onFormat={(name, format) =>
          setFormats((f) => {
            const { [name]: _removed, ...rest } = f;
            void _removed;
            return format ? { ...rest, [name]: format } : { ...rest, ...(flat.bundle.formats?.[name] ? { [name]: undefined as unknown as VarFormat } : {}) };
          })
        }
        onType={(name, type) =>
          setTypes((t) => {
            const { [name]: _removed, ...rest } = t;
            void _removed;
            return type === "number" ? { ...rest, ...(flat.bundle.types?.[name] && flat.bundle.types[name] !== "number" ? { [name]: "number" as VarType } : {}) } : { ...rest, [name]: type };
          })
        }
        choiceTexts={choiceText}
        onChoiceText={(name, text) => setChoiceText((c) => ({ ...c, [name]: text }))}
        extraCount={tableDrafts.length + collectionDrafts.length + included.length}
        addVariable={
          <AddVariable
            boards={availableBoards.filter((b) => b.id !== (editing?.id ?? suggesting?.boardId))}
            busy={loadingBoard}
            onAdd={addVariable}
          />
        }
        boardRows={Object.fromEntries(
          included.map((inc) => [
            inc.alias,
            (children: React.ReactNode, handle?: React.ReactNode) => (
            <BoardRow
              key={inc.alias}
              handle={handle}
              inc={includeOf(inc)}
              includes={included.map(includeOf)}
              included={included}
              isOpen={typedFold.isOpen}
              onToggle={typedFold.toggle}
              onAlias={renameAlias}
              onName={(alias, name) => setIncluded((list) => list.map((i) => (i.alias === alias ? { ...i, name } : i)))}
              onPin={pinBoard}
              onRemove={(alias) => {
                setIncluded((list) => list.filter((i) => i.alias !== alias));
                // A drawing can't read a variable of a board that is no longer used.
                setVisualizations((vs) => dropFromVisualizations(vs, (name) => name.startsWith(alias + "$")));
              }}
            >
              {children}
            </BoardRow>
            ),
          ]),
        )}
        notice={boardError ? <p className="text-danger">{boardError}</p> : undefined}
        typedItems={[
          ...tableItems({ drafts: tableDrafts, problems: tableProblems, onChange: setTableDrafts, isOpen: typedFold.isOpen, onToggle: typedFold.toggle }),
          ...collectionItems({
            drafts: collectionDrafts,
            usedNames: included.map((i) => i.alias),
            available: availableBoards.filter((b) => b.id !== (editing?.id ?? suggesting?.boardId)),
            onChange: setCollectionDrafts,
            isOpen: typedFold.isOpen,
            onToggle: typedFold.toggle,
          }),
        ]}
        onOrder={(names) => setOrder((o) => [...o.filter((n) => !names.includes(n)), ...names])}
        ranges={Object.fromEntries(Object.entries(flat.bundle.ranges).map(([k, r]) => [k, { min: r.min === undefined ? "" : toLocaleText(String(r.min), numLocale), max: r.max === undefined ? "" : toLocaleText(String(r.max), numLocale) }]))}
        onRange={(name, end, text) =>
          setRangeText((r) => {
            const inherited = flat.bundle.ranges[name];
            const was = r[name] ?? { min: inherited?.min === undefined ? "" : String(inherited.min), max: inherited?.max === undefined ? "" : String(inherited.max) };
            return { ...r, [name]: { ...was, [end]: text } };
          })
        }
      />

      <VisualizationEditor
        analysis={analysis}
        labels={flat.bundle.labels}
        visualizations={visualizations}
        onChange={setVisualizations}
      />

      <CollapsibleSection
        title="Try it"
        description={
          <>
            Change any variable. Values you type get locked and the formulas never change them; everything
            unlocked is recalculated. Tap a lock to release it. These values are saved as what people see first.
          </>
        }
      >
        <CalculatorPanel
          key={panelKey}
          analysis={analysis}
          values={flat.bundle.values}
          onChange={setValues}
          initialLocked={loadedLocks}
          onLocks={setLocks}
          descriptions={flat.bundle.descriptions}
          units={flat.bundle.units}
          labels={flat.bundle.labels}
          hidden={flat.bundle.hidden}
          revealHidden
          decimals={flat.bundle.decimals}
          ranges={flat.bundle.ranges}
          order={flat.bundle.order}
          types={flat.bundle.types}
          formats={flat.bundle.formats}
          choices={flat.bundle.choices}
          groups={flat.bundle.groups}
          sectionExtras={Object.fromEntries(
            collections.map((c) => [
              c.name,
              <TryItems
                key={c.name}
                boards={
                  c.boards && c.boards.length > 0
                    ? availableBoards.filter((b) => c.boards!.includes(b.id))
                    : availableBoards.filter((b) => b.id !== (editing?.id ?? suggesting?.boardId))
                }
                busy={loadingBoard}
                onAdd={(id, preset) => addTryItem(c.name, id, preset)}
              />,
            ]),
          )}
          sectionActions={Object.fromEntries(
            liveTryItems.map((t) => [
              t.alias,
              <button key={t.alias} type="button" className="link text-base text-danger" aria-label={`Take ${t.title} out of ${t.group}`} onClick={() => setTryItems((list) => list.filter((x) => x.alias !== t.alias))}>
                Remove
              </button>,
            ]),
          )}
          visualizations={flat.bundle.visualizations}
        />
        <div className="flex flex-col gap-2">
          <h3 className="text-xl">Presets</h3>
          <p className="text-base text-ink-muted">
            Save the numbers above as a named preset, such as Small or Large. Everyone using the board sees its presets and can load one, and a board added to a collection
            or used inside another board can start from one.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <input
              className="field min-w-[12rem] flex-1 text-xl"
              value={presetName}
              maxLength={SCENARIO_LIMITS.name}
              placeholder="Name of the preset"
              onChange={(e) => setPresetName(e.target.value)}
              aria-label="Name of the preset"
            />
            <button
              type="button"
              className="btn"
              disabled={!presetName.trim() || presets.length >= MAX_PRESETS}
              onClick={() => {
                const name = presetName.trim().replace(/\s+/g, " ");
                const snapshot = { name, values: { ...flat.bundle.values }, locked: locks ?? initialLocks(analysis, flat.bundle.values) };
                setPresets((list) => [...list.filter((p) => p.name !== name), snapshot]);
                setPresetName("");
              }}
            >
              Save these values as a preset
            </button>
          </div>
          <details className="text-base">
            <summary className="link cursor-pointer">Import presets from a table</summary>
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-ink-muted">
                Paste rows from a spreadsheet or a CSV file. The first row names the variables (by name or by the label they have); the first column that is not a
                variable holds the name of each preset, and every row after it becomes a preset with those values.
              </p>
              <textarea
                className="field min-h-24 text-base"
                value={tableText}
                placeholder={"Name\tLowest hit\tHighest hit\nDagger\t6\t11\nSword\t14\t22"}
                onChange={(e) => setTableText(e.target.value)}
                aria-label="Table of presets"
              />
              <div className="flex flex-wrap items-baseline gap-3">
                <button
                  type="button"
                  className="btn"
                  disabled={!tableText.trim()}
                  onClick={() => {
                    const out = parseTable(tableText, analysis.variables.map((v) => v.name), flat.bundle.labels);
                    const names = new Set(out.presets.map((p) => p.name));
                    const merged = [...presets.filter((p) => !names.has(p.name)), ...out.presets];
                    if (merged.length > MAX_PRESETS) {
                      setTableNote(`A board can have ${MAX_PRESETS} presets; this would make ${merged.length}. Remove some first.`);
                      return;
                    }
                    setPresets(merged);
                    setTableNote(
                      [
                        out.presets.length > 0 ? `Added ${out.presets.length} ${out.presets.length === 1 ? "preset" : "presets"}.` : "Nothing was added.",
                        out.unmatched.length > 0 ? `Not variables of this board, so left out: ${out.unmatched.join(", ")}.` : "",
                        ...out.skipped,
                      ]
                        .filter(Boolean)
                        .join(" "),
                    );
                    if (out.presets.length > 0) setTableText("");
                  }}
                >
                  Add these presets
                </button>
                {tableNote && <span className="text-ink-muted">{tableNote}</span>}
              </div>
            </div>
          </details>
          {presets.length > 0 && (
            <ul className="flex flex-col gap-1">
              {presets.map((p) => (
                <li key={p.name} className="flex flex-wrap items-baseline gap-x-4 text-xl">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <button
                    type="button"
                    className="link text-base"
                    onClick={() => {
                      setValues({ ...flat.bundle.values, ...p.values });
                      setLocks(p.locked);
                      setLoadedLocks(p.locked);
                      setPanelKey((k) => k + 1);
                    }}
                  >
                    Load
                  </button>
                  <button type="button" className="link text-base text-danger" aria-label={`Remove the preset ${p.name}`} onClick={() => setPresets((list) => list.filter((x) => x.name !== p.name))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xl">
            Checks{checks.length > 0 && <span className="text-lg font-normal text-ink-muted"> ({checks.length})</span>}
          </h3>
          <p className="text-base text-ink-muted">
            Save the numbers above as a check: the values you typed (locked) are put in, and the other results are what the board
            should work out. A check is run again whenever the board is shown, so a change to the formulas that breaks it is seen
            straight away. Checks are kept when you save the board.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <input
              className="field min-w-[12rem] flex-1 text-xl"
              value={checkName}
              maxLength={CHECK_LIMITS.name}
              placeholder="Name of the check, for example 3 by 4"
              onChange={(e) => setCheckName(e.target.value)}
              aria-label="Name of the check"
            />
            <button type="button" className="btn" disabled={!checkName.trim() || checks.length >= CHECK_LIMITS.checks} onClick={saveCheck}>
              Save these numbers as a check
            </button>
          </div>
          {checks.length > 0 && (
            <ChecksList results={checkResults} labels={flat.bundle.labels} onRemove={(i) => onChecks(checks.filter((_, n) => n !== i))} />
          )}
        </div>
      </CollapsibleSection>

      {errors.length > 0 && (
        <ul className="sketch-box border-danger px-4 py-3 text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {suggesting && (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Your suggestion</h2>
          <textarea
            className="field resize-none"
            placeholder="What did you change, and why? (optional)"
            rows={3}
            value={message}
            maxLength={500}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="What the suggestion is about"
          />
        </section>
      )}

      <div>
        <button type="submit" disabled={pending || problems.length > 0} className="btn btn-primary">
          {pending ? "Saving…" : suggesting ? "Send suggestion" : "Save"}
        </button>
      </div>
    </form>
  );
}