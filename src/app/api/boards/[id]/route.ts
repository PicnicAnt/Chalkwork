import { NextResponse, type NextRequest } from "next/server";
import { solveBoard } from "@/lib/board-api";
import { getBoard } from "@/lib/db";
import { resolveForView } from "@/lib/resolve-boards";

// A board as a small web service. GET /api/boards/<id>?width=3&height=4 (names as shown, such as room.width) or
// POST the same as JSON ({ "inputs": { "width": 3 } }) returns every variable the board works out. Boards are
// public by their link, so this is too; it is meant for other tools to use a board as a calculator.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

// A simple limit per address, so one caller can't hold the server busy: 120 requests a minute.
const hits = new Map<string, number[]>();
function tooMany(request: NextRequest): boolean {
  const who = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(who) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(who, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= 60_000)) hits.delete(k);
  return recent.length > 120;
}

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });

async function answer(request: NextRequest, params: Promise<{ id: string }>, inputs: Record<string, unknown>) {
  if (tooMany(request)) return reply({ error: "Too many requests. Try again in a minute." }, 429);
  const board = getBoard((await params).id);
  if (!board) return reply({ error: "No such board." }, 404);
  const resolved = resolveForView(board);
  if ("error" in resolved) return reply({ error: resolved.error }, 422);
  const solved = solveBoard(resolved.bundle, inputs);
  if (!solved.ok) return reply({ error: solved.error }, solved.status);
  return reply({ board: { id: board.id, title: board.title, description: board.description }, inputs: solved.inputs, results: solved.results });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return answer(request, params, Object.fromEntries(request.nextUrl.searchParams.entries()));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ error: "Send JSON, such as { \"inputs\": { \"width\": 3 } }." }, 400);
  }
  const given = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as { inputs?: unknown }).inputs ?? body : null;
  if (typeof given !== "object" || given === null || Array.isArray(given)) return reply({ error: "Send the inputs as an object." }, 400);
  return answer(request, params, given as Record<string, unknown>);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
