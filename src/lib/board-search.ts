// Searching boards by their words, shared by the browse page and the picker for adding a board.

// The words typed in a search box. A board matches when every word is found in its title or
// description, ignoring case, so "dps exile" finds a board with both anywhere in those two fields.
export const wordsOf = (query: string) => query.toLocaleLowerCase().split(/\s+/).filter(Boolean);

export const matchesWords = (text: string, words: readonly string[]) => {
  const haystack = text.toLocaleLowerCase();
  return words.every((w) => haystack.includes(w));
};