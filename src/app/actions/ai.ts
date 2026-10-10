"use server";

import { getCurrentUser } from "@/lib/auth";
import { AI_LIMITS, aiConfig, draftFrom, explainWith, makeLimiter, messagesAsk } from "@/lib/ai";
import type { BoardDraft } from "@/lib/board-draft";
import { getBoard } from "@/lib/db";
import { prepare } from "./prepare";

// The writing helper. Every use is paid for in tokens, so each action checks who is asking and how often.

const allowed = makeLimiter(AI_LIMITS.perHour);

export type DraftOutcome = { ok: true; draft: BoardDraft } | { ok: false; error: string };
export type ExplainOutcome = { ok: true; text: string } | { ok: false; error: string };

// Whether the helper can be used at all, so the page can hide the buttons when it can't.
export async function helperAvailable(): Promise<boolean> {
  return "key" in aiConfig();
}

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
  });
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
