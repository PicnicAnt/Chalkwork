import { NextResponse, type NextRequest } from "next/server";
import { draftOf } from "@/lib/change-suggestions";
import { getBoard } from "@/lib/db";
import { fileNameOf } from "@/lib/export";

// A board as a file (JSON) that can be kept, sent on, or imported on another Chalkwork (New → Import a board file).
// Boards are public by their link, so this is too. The boards it uses are listed by id: they have to exist where
// it is imported to be used there.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const board = getBoard((await params).id);
  if (!board) return NextResponse.json({ error: "No such board." }, { status: 404 });
  const file = { format: "chalkwork-board", version: 1, exportedAt: new Date().toISOString(), board: draftOf(board) };
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileNameOf(board.title)}.chalkwork.json"`,
      "Cache-Control": "no-store",
    },
  });
}
