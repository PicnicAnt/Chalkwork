"use server";

import { getCurrentUser } from "@/lib/auth";
import { AI_LIMITS, aiConfig, catalogText, draftFrom, explainWith, makeLimiter, messagesAsk, relevantBoards, reviseFrom, type CatalogBoard } from "@/lib/ai";
import { diffDrafts } from "@/lib/change-suggestions";
import { parseIncludes, type IncludedBundle } from "@/lib/boards";
import { resolveIncludes } from "@/lib/resolve-boards";
import { analyzeFormulas, displayName } from "@/lib/formulas";
import { VIZ_TYPES } from "@/lib/visualizations";
import type { BoardDraft } from "@/lib/board-draft";
import { getBoard, listAllBoards } from "@/lib/db";
import { prepare } from "./prepare";

// The writing helper. Every use is paid for in tokens, so each action checks who is asking and how often.

const allowed = makeLimiter(AI_LIMITS.perHour);

export type DraftOutcome = { ok: true; draft: BoardDraft } | { ok: false; error: string };
export type ExplainOutcome = { ok: true; text: string } | { ok: false; error: string };

// Whether the helper can be used at all, so the page can hide the buttons when it can't.
export async function helperAvailable(): Promise<boolean> {
  return "key" in aiConfig();
}

// The boards worth offering for a description, with their variables, so the draft can use them.
function boardCatalog(description: string, alwaysIds: readonly string[] = [], exceptId?: string): CatalogBoard[] {
  const all = listAllBoards().filter((b) => b.id !== exceptId);
  const chosen = [...relevantBoards(all, description), ...all.filter((b) => alwaysIds.includes(b.id))];
  return chosen.filter((b, i) => chosen.findIndex((x) => x.id === b.id) === i).flatMap((b) => {
    const board = getBoard(b.id);
    if (!board) return [];
    const variables = analyzeFormulas(board.formulas, board.tables)
      .variables.filter((v) => board.hidden[v.name] !== true)
      .map((v) => displayName(v.name));
    return [{ id: b.id, title: b.title, description: b.description, variables }];
  });
}

const DRAWINGS = VIZ_TYPES.map((t) => ({
  id: t.id,
  label: t.label,
  params: t.params.map((p) => ({ key: p.key, label: p.label, optional: p.optional })),
  lists: (t.lists ?? []).map((l) => ({ key: l.key, label: l.label })),
  options: (t.options ?? []).map((o) => ({ key: o.key, label: o.label })),
}));

export async function draftBoard(description: unknown): Promise<DraftOutcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to use the writing helper." };
  const config = aiConfig();
  if ("error" in config) return { ok: false, error: config.error };
  if (typeof description !== "string" || !description.trim()) return { ok: false, error: "Describe what you want to calculate first." };
  if (!allowed(user.id)) return { ok: false, error: `The helper can be used ${AI_LIMITS.perHour} times an hour. Try again a little later.` };

  const result = await draftFrom(messagesAsk(config), description, (payload) => {
    const prepared = prepare(payload);
    return "errors" in prepared ? { ok: false, errors: prepared.errors } : { ok: true };
  }, catalogText(boardCatalog(description), DRAWINGS));
  if (!result.ok) return result;
  const prepared = prepare(result.draft);
  if ("errors" in prepared) return { ok: false, error: "The draft didn't pass the checks." };
  return { ok: true, draft: prepared.draft };
}

export async function explainBoard(boardId: unknown): Promise<ExplainOutcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to use the writing helper." };
  const config = aiConfig();
  if ("error" in config) return { ok: false, error: config.error };
  const board = typeof boardId === "string" ? getBoard(boardId) : null;
  if (!board) return { ok: false, error: "That board doesn't exist." };
  if (!allowed(user.id)) return { ok: false, error: `The helper can be used ${AI_LIMITS.perHour} times an hour. Try again a little later.` };
  try {
    const text = (await explainWith(messagesAsk(config), board)).trim();
    return text ? { ok: true, text } : { ok: false, error: "The helper gave no answer." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The helper couldn't be reached." };
  }
}

export type ReviseOutcome =
  | { ok: true; draft: BoardDraft; included: IncludedBundle[]; changes: string[] }
  | { ok: false; error: string };

// Changes the board that is open in the editor as asked. `selfId` is the board being edited (it can't use itself) and
// `current` what the editor holds now, which may not be saved yet. Nothing is saved here: the editor shows the
// result and the person saves it, or goes back.
export async function reviseBoard(selfId: unknown, current: unknown, instruction: unknown): Promise<ReviseOutcome> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to use the writing helper." };
  const config = aiConfig();
  if ("error" in config) return { ok: false, error: config.error };
  if (typeof instruction !== "string" || !instruction.trim()) return { ok: false, error: "Say what to change first." };
  const self = typeof selfId === "string" && selfId ? selfId : undefined;
  const now = prepare(current, self);
  if ("errors" in now) return { ok: false, error: `The board has a problem the helper can't work around: ${now.errors[0]}` };
  if (!allowed(user.id)) return { ok: false, error: `The helper can be used ${AI_LIMITS.perHour} times an hour. Try again a little later.` };

  const using = now.draft.includes.map((i) => i.board);
  const result = await reviseFrom(
    messagesAsk(config),
    now.draft,
    instruction,
    (payload) => {
      const prepared = prepare(payload, self);
      return "errors" in prepared ? { ok: false, errors: prepared.errors } : { ok: true };
    },
    catalogText(boardCatalog(`${instruction} ${now.draft.title}`, using, self), DRAWINGS),
  );
  if (!result.ok) return result;
  const prepared = prepare(result.draft, self);
  if ("errors" in prepared) return { ok: false, error: "The change didn't pass the checks." };
  const included = resolveIncludes(parseIncludes(prepared.draft.includes).includes, self);
  if ("error" in included) return { ok: false, error: included.error };
  const changes = diffDrafts(now.draft, prepared.draft);
  if (changes.length === 0) return { ok: false, error: "The helper didn't change anything. Try saying it differently." };
  return { ok: true, draft: prepared.draft, included: included.included, changes };
}
