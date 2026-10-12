"use server";

import { getCurrentUser } from "@/lib/auth";
import { matchesWords, wordsOf } from "@/lib/board-search";
import { listAllBoards } from "@/lib/db";

export type JumpBoard = { id: string; title: string; description: string };

// The boards that fit what was typed, for the quick-jump box: the ones with the words in their title first.
export async function findBoards(query: unknown): Promise<JumpBoard[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const words = wordsOf(typeof query === "string" ? query.slice(0, 100) : "");
  const all = listAllBoards(1000, user.id);
  const fits = words.length === 0 ? all : all.filter((b) => matchesWords(`${b.title}\n${b.description}\n${b.tags.join(" ")}\n${b.keywords}`, words));
  const inTitle = (title: string) => (matchesWords(title, words) ? 0 : 1);
  return [...fits]
    .sort((a, b) => inTitle(a.title) - inTitle(b.title))
    .slice(0, 8)
    .map((b) => ({ id: b.id, title: b.title, description: b.description.slice(0, 120) }));
}
