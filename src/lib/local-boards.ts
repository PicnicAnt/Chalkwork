// Boards made without signing in are kept in this browser only. They are not sent to the server, so nobody else can
// open them and clearing the browser's data removes them; signing in lets a board be saved to the account instead.
import type { BoardDraft } from "./board-draft";
import type { Check } from "./checks";

export type LocalBoard = {
  id: string;
  draft: BoardDraft;
  /** A data URL, or empty for none. */
  image: string;
  checks: Check[];
  createdAt: string;
  updatedAt: string;
};

const KEY = "chalkwork:local-boards";
const EVENT = "chalkwork-local-boards";

const parse = (raw: string | null): LocalBoard[] => {
  try {
    const list = raw ? (JSON.parse(raw) as LocalBoard[]) : [];
    return Array.isArray(list) ? list.filter((b) => b && typeof b.id === "string" && b.draft) : [];
  } catch {
    return [];
  }
};

// The raw text kept, which is what a component subscribes to (it only changes when a board does).
export const readLocalRaw = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

export const parseLocalBoards = (raw: string): LocalBoard[] => parse(raw).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export function subscribeLocalBoards(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function write(list: LocalBoard[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

const newId = () => `l${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

// Saves a board on this device: a new one, or a change to the one with that id. Throws when the browser's store is full.
export function saveLocalBoard(input: { id?: string; draft: BoardDraft; image: string; checks: Check[] }): LocalBoard {
  const list = parse(readLocalRaw());
  const now = new Date().toISOString();
  const existing = input.id ? list.find((b) => b.id === input.id) : undefined;
  const saved: LocalBoard = {
    id: existing?.id ?? input.id ?? newId(),
    draft: input.draft,
    image: input.image,
    checks: input.checks,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  write([saved, ...list.filter((b) => b.id !== saved.id)]);
  return saved;
}

export function removeLocalBoard(id: string) {
  write(parse(readLocalRaw()).filter((b) => b.id !== id));
}
