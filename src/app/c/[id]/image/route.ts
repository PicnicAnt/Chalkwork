import { getCurrentUser } from "@/lib/auth";
import { defaultImageSvg, parseImage } from "@/lib/board-image";
import { getBoard, getBoardImage } from "@/lib/db";
import { canOpen } from "@/lib/visibility";

// The picture of a board, for the lists: the one it was given, or a plain one made from its title and first drawing.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = getBoard(id);
  const user = await getCurrentUser();
  if (!board || !canOpen(board, user?.id)) return new Response("Not found", { status: 404 });
  const stored = parseImage(getBoardImage(id));
  const body = stored ? new Uint8Array(stored.bytes) : defaultImageSvg(board.title, board.visualizations[0]?.type);
  return new Response(body, {
    headers: {
      "Content-Type": stored?.mime ?? "image/svg+xml",
      // Pictures are not documents: nothing in one can run, whatever it contains.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
