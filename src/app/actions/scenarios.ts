"use server";

import { getCurrentUser } from "@/lib/auth";
import { countScenarios, getBoard, insertScenario, removeScenario } from "@/lib/db";
import { parseSnapshot, SCENARIO_LIMITS } from "@/lib/scenarios";

// Saved sets of values are private to the person who saved them. Every action checks who is asking.

export type ScenarioResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveScenario(boardId: string, name: unknown, snapshot: unknown): Promise<ScenarioResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save a scenario." };
  if (typeof boardId !== "string" || !getBoard(boardId)) return { ok: false, error: "That board doesn't exist." };
  const title = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!title) return { ok: false, error: "Give the scenario a name." };
  if (title.length > SCENARIO_LIMITS.name) return { ok: false, error: `The name can be at most ${SCENARIO_LIMITS.name} characters.` };
  const parsed = parseSnapshot(snapshot);
  if (!parsed) return { ok: false, error: "Those values can't be saved." };
  if (countScenarios(boardId, user.id) >= SCENARIO_LIMITS.perBoard) {
    return { ok: false, error: `You can keep ${SCENARIO_LIMITS.perBoard} scenarios on a board. Delete one first.` };
  }
  return { ok: true, id: insertScenario(boardId, user.id, title, parsed) };
}

export async function deleteScenario(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof id !== "string") return { ok: false };
  return { ok: removeScenario(id, user.id) };
}
