import { ImageResponse } from "next/og";
import { defaultImageSvg, parseImage, svgDataUrl } from "@/lib/board-image";
import { getBoard, getBoardImage } from "@/lib/db";
import { canOpen } from "@/lib/visibility";

// The card shown when a board's link is pasted in a chat: its picture, title and description. Only boards anyone
// with the link can open get their own card; others get the plain site card.
export const alt = "A Chalkwork board";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = getBoard(id);
  const open = board !== null && canOpen(board, undefined);
  const title = open ? board.title : "Chalkwork";
  const description = open ? board.description : "Boards of formulas that solve in every direction.";
  const stored = open ? getBoardImage(id) : null;
  const picture = open ? (parseImage(stored) && stored ? stored : svgDataUrl(defaultImageSvg(board.title, board.visualizations[0]?.type))) : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#18211c", color: "#eef0e6", padding: 64, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 48 }}>
          <div style={{ display: "flex", fontSize: 30, color: "#f5e58c", marginBottom: 24 }}>Chalkwork</div>
          <div style={{ display: "flex", fontSize: title.length > 40 ? 60 : 80, fontWeight: 700, lineHeight: 1.1 }}>{title.slice(0, 80)}</div>
          {description && (
            <div style={{ display: "flex", fontSize: 34, color: "rgba(238,240,230,0.7)", marginTop: 28, lineHeight: 1.3 }}>{description.slice(0, 180)}</div>
          )}
          {open && <div style={{ display: "flex", fontSize: 28, color: "rgba(238,240,230,0.5)", marginTop: 36 }}>by {board.ownerName}</div>}
        </div>
        {picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} width={380} height={285} alt="" style={{ objectFit: "contain" }} />
        )}
      </div>
    ),
    size,
  );
}
