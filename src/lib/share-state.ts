import { parseSnapshot, type ScenarioSnapshot } from "./scenarios";

// The state of a board (the values that were typed, and so locked) as text that fits in a link, so a board can
// be opened with someone's numbers already in place: /c/<id>?state=<this>. It carries only what was typed.
export const MAX_STATE_LENGTH = 6000;

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const fromBase64Url = (text: string) => {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
};

export function encodeState(snapshot: ScenarioSnapshot): string {
  const values = Object.fromEntries(snapshot.locked.filter((name) => name in snapshot.values).map((name) => [name, snapshot.values[name]]));
  return toBase64Url(JSON.stringify({ values, locked: snapshot.locked }));
}

// Reads a state from a link, or returns null for anything that isn't one (it comes from outside, so it is checked).
export function decodeState(text: string | undefined): ScenarioSnapshot | null {
  if (!text || text.length > MAX_STATE_LENGTH) return null;
  try {
    return parseSnapshot(JSON.parse(fromBase64Url(text)));
  } catch {
    return null;
  }
}
