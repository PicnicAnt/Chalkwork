import { boardsUsing, getBoard, insertNotification } from "@/lib/db";

// Telling people about what happened to boards they care about. Not an action itself (no "use server"): the actions
// call it after they have done their work.

const quote = (title: string) => `“${title}”`;

// The owner of a board changed it: the owners of the boards that use it are told, since what they see may have moved.
export function notifyBoardChanged(boardId: string, actorId: string): void {
  const board = getBoard(boardId);
  if (!board) return;
  const told = new Set<string>();
  for (const user of boardsUsing(boardId)) {
    if (!user.ownerId || user.ownerId === actorId || told.has(user.ownerId + user.id)) continue;
    told.add(user.ownerId + user.id);
    insertNotification({
      userId: user.ownerId,
      kind: "used-board-changed",
      boardId: user.id,
      text: `${quote(board.title)} was changed, and your board ${quote(user.title)} uses it.`,
      link: `/c/${user.id}`,
    });
  }
}

export function notify(userId: string | null, actorId: string, kind: string, boardId: string, text: string, link: string): void {
  if (!userId || userId === actorId) return;
  insertNotification({ userId, kind, boardId, text, link });
}
