import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512];

// The app's icon: a chalk equals sign on the board's dark green, as a square picture. The maskable one has more room
// around the sign, since phones crop it to a circle or a rounded square.
export async function GET(request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const inner = size * (maskable ? 0.42 : 0.56);
  const bar = Math.round(inner * 0.2);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#18211c", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: inner,
            height: inner * 0.62,
          }}
        >
          <div style={{ display: "flex", width: "100%", height: bar, background: "#f5e58c", borderRadius: bar }} />
          <div style={{ display: "flex", width: "100%", height: bar, background: "#eef0e6", borderRadius: bar }} />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
