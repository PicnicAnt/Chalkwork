// Who can open a board and who is shown it in lists.
//   public  - listed on the Boards page and in the lists for adding boards, and open to anyone with the link
//   link    - open to anyone with the link, but not listed for anyone else
//   private - only its owner can open it
// Plain logic, so the server and the editor agree.

export type Visibility = "public" | "link" | "private";

export const VISIBILITIES: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "Everyone", hint: "Listed on Boards, and open to anyone with the link." },
  { value: "link", label: "Anyone with the link", hint: "Open to anyone who has the link, but not listed." },
  { value: "private", label: "Only me", hint: "Only you can open it, including the web service and the embed." },
];

export const visibilityOf = (value: unknown): Visibility => (value === "link" || value === "private" ? value : "public");

/** Whether this person can open the board. */
export const canOpen = (board: { visibility?: Visibility; ownerId: string | null }, viewerId: string | null | undefined): boolean =>
  visibilityOf(board.visibility) !== "private" || (viewerId != null && board.ownerId === viewerId);

/** Whether the board is shown to this person in lists (the Boards page, pickers, search). */
export const isListed = (board: { visibility?: Visibility; ownerId: string | null }, viewerId: string | null | undefined): boolean =>
  visibilityOf(board.visibility) === "public" || (viewerId != null && board.ownerId === viewerId);
