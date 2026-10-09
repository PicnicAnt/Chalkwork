// Tags: short labels on a board (finance, game, geometry) that make it easier to find. Plain logic.

export const TAG_LIMITS = { count: 8, length: 24 };

// One tag as stored: lower case, words joined with dashes, only letters, digits and dashes.
export const cleanTag = (text: string): string =>
  text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TAG_LIMITS.length)
    .replace(/-+$/g, "");

// Tags typed with commas between them, or a list that was sent: cleaned, without repeats or empty ones.
export function parseTags(raw: unknown): string[] {
  const items = typeof raw === "string" ? raw.split(",") : Array.isArray(raw) ? raw : [];
  const tags: string[] = [];
  for (const item of items) {
    const tag = typeof item === "string" ? cleanTag(item) : "";
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags.slice(0, TAG_LIMITS.count);
}
