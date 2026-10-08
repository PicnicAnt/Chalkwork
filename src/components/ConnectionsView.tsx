"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { setBoardLinks } from "@/app/actions/boards";
import { groupOf, type Bundle } from "@/lib/boards";
import { displayName, type Analysis } from "@/lib/formulas";

type Edge = { a: string; b: string; kind: "link" | "formula" | "shared"; /** A link made on this board, which can be removed here. */ own?: boolean };

const NAME = "[A-Za-z_][A-Za-z0-9_]*(?:\\$[A-Za-z_][A-Za-z0-9_]*)*";
const PLAIN_EQUATION = new RegExp(`^\\s*(${NAME})\\s*=\\s*(${NAME})\\s*$`);

// The strings between boards: every link, and every formula that is just one variable equal to another.
function edgesOf(
  flat: Bundle,
  analysis: Analysis,
  groupOfVar: (name: string) => string,
  shared: boolean,
  ownLinks: Record<string, string>,
): Edge[] {
  const found = new Map<string, Edge>();
  const add = (a: string, b: string, kind: Edge["kind"], own = false) => {
    if (a === b || groupOfVar(a) === groupOfVar(b)) return;
    const key = [a, b].sort().join("|");
    if (!found.has(key)) found.set(key, { a, b, kind, own });
  };
  for (const [a, b] of Object.entries(flat.links)) add(a, b, "link", ownLinks[a] === b);
  for (const formula of flat.formulas) {
    const m = PLAIN_EQUATION.exec(formula);
    if (m) add(m[1], m[2], "formula");
  }
  // Optionally, every pair of variables from different boards that appear in one formula.
  if (shared) {
    for (const formula of analysis.formulas) {
      if (formula.error) continue;
      const vars = [...new Set(formula.vars)];
      for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) add(vars[i], vars[j], "shared");
    }
  }
  return [...found.values()];
}

// A detective's board: each board is a note pinned up, and a red string runs between every pair of
// variables that are linked across boards. The strings are SVG paths positioned from the real
// positions of the rows, so they follow the layout at any width.
export function ConnectionsView({
  analysis,
  flat,
  editable,
}: {
  analysis: Analysis;
  flat: Bundle;
  /** Set for the owner of the board: the strings can then be edited. `ownLinks` are the links made on this board. */
  editable?: { boardId: string; ownLinks: Record<string, string> };
}) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const ownLinks = editable?.ownLinks;
  const topGroups = Object.keys(flat.groups).filter((key) => !key.includes("$"));
  const groupOfVar = (name: string) => {
    const g = groupOf(name);
    return g && topGroups.includes(g) ? g : "";
  };

  const [shared, setShared] = useState(false);
  const edges = useMemo(
    () => edgesOf(flat, analysis, groupOfVar, shared, ownLinks ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flat, analysis, shared, ownLinks],
  );
  const linked = useMemo(() => new Set(edges.flatMap((e) => [e.a, e.b])), [edges]);

  const cards = [
    { key: "", title: "This board", board: null as string | null },
    ...topGroups.map((key) => ({ key, title: flat.groups[key].title, board: flat.groups[key].board })),
  ]
    .map((card) => ({
      ...card,
      all: analysis.variables.filter((v) => groupOfVar(v.name) === card.key && flat.hidden[v.name] !== true),
    }))
    // Only boards with something linked are pinned up, unless the links are being edited.
    .filter((card) => editing || card.all.some((v) => linked.has(v.name)));

  const boardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const pinRefs = useRef<(SVGGElement | null)[]>([]);
  const hitRefs = useRef<(SVGPathElement | null)[]>([]);

  // Saves the new set of this board's own links; the page is then reloaded with the result.
  function save(next: Record<string, string>) {
    if (!editable) return;
    setProblem(null);
    startSaving(async () => {
      const result = await setBoardLinks(editable.boardId, next);
      if (result.ok) router.refresh();
      else setProblem(result.errors.join(" "));
    });
  }

  function pick(name: string) {
    if (!editing || !ownLinks || saving) return;
    if (picked === null || picked === name) {
      setPicked(picked === name ? null : name);
      return;
    }
    const [a, b] = [picked, name];
    setPicked(null);
    if (groupOfVar(a) === groupOfVar(b)) {
      setProblem("Pick two variables on different boards.");
      return;
    }
    if (ownLinks[a] === b || ownLinks[b] === a) return;
    // A variable can have one link of its own; the other end may take it if the first is busy.
    if (!(a in ownLinks)) save({ ...ownLinks, [a]: b });
    else if (!(b in ownLinks)) save({ ...ownLinks, [b]: a });
    else setProblem(`${displayName(a)} and ${displayName(b)} each have a link already. Remove one first.`);
  }

  function cut(edge: Edge) {
    if (!editing || !ownLinks || saving || !edge.own) return;
    const next = { ...ownLinks };
    if (next[edge.a] === edge.b) delete next[edge.a];
    else delete next[edge.b];
    save(next);
  }

  useEffect(() => {
    const board = boardRef.current;
    const svg = svgRef.current;
    if (!board || !svg) return;

    function layout() {
      if (!board || !svg) return;
      const origin = board.getBoundingClientRect();
      svg.setAttribute("width", String(origin.width));
      svg.setAttribute("height", String(origin.height));
      edges.forEach((edge, i) => {
        const ra = rowRefs.current.get(edge.a)?.getBoundingClientRect();
        const rb = rowRefs.current.get(edge.b)?.getBoundingClientRect();
        const path = pathRefs.current[i];
        const pins = pinRefs.current[i];
        if (!ra || !rb || !path || !pins) return;
        const ay = ra.top + ra.height / 2 - origin.top;
        const by = rb.top + rb.height / 2 - origin.top;
        const ca = ra.left + ra.width / 2 - origin.left;
        const cb = rb.left + rb.width / 2 - origin.left;
        let ax: number, bx: number, c1: number, c2: number;
        if (Math.abs(ca - cb) < 60) {
          // Same column: both strings leave on the right and loop out around the notes.
          ax = ra.right - origin.left;
          bx = rb.right - origin.left;
          const bulge = 46 + Math.min(80, Math.abs(ay - by) / 4);
          c1 = ax + bulge;
          c2 = bx + bulge;
        } else if (ca < cb) {
          ax = ra.right - origin.left;
          bx = rb.left - origin.left;
          const pull = Math.max(40, (bx - ax) / 2);
          c1 = ax + pull;
          c2 = bx - pull;
        } else {
          ax = ra.left - origin.left;
          bx = rb.right - origin.left;
          const pull = Math.max(40, (ax - bx) / 2);
          c1 = ax - pull;
          c2 = bx + pull;
        }
        // The string sags a little, as a real one would.
        const sag = 14;
        const d = `M ${ax} ${ay} C ${c1} ${ay + sag}, ${c2} ${by + sag}, ${bx} ${by}`;
        path.setAttribute("d", d);
        hitRefs.current[i]?.setAttribute("d", d);
        const [pa, pb] = [pins.children[0], pins.children[1]];
        pa.setAttribute("cx", String(ax));
        pa.setAttribute("cy", String(ay));
        pb.setAttribute("cx", String(bx));
        pb.setAttribute("cy", String(by));
      });
    }

    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(board);
    // Fonts change the row heights once they arrive.
    void document.fonts?.ready.then(layout);
    return () => observer.disconnect();
  }, [edges, editing]);

  const option = (
    <label className="mb-3 flex items-center gap-2 text-lg">
      <input
        type="checkbox"
        checked={shared}
        onChange={(e) => setShared(e.target.checked)}
        className="h-5 w-5 accent-[var(--accent)]"
      />
      Also connect variables used in the same formula
    </label>
  );

  const editBar = editable ? (
    <div className="mb-3 flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={editing}
        onClick={() => {
          setEditing((e) => !e);
          setPicked(null);
          setProblem(null);
        }}
        className={`self-start text-lg ${editing ? "text-accent underline decoration-wavy underline-offset-4" : "link"}`}
      >
        {editing ? "Done editing" : "Edit connections"}
      </button>
      {editing && (
        <p className="text-base text-ink-muted">
          Click a variable, then a variable on another board, to connect them with a string. Click one of the solid
          strings to cut it. {saving && "Saving…"}
        </p>
      )}
      {problem && <p className="text-danger">{problem}</p>}
    </div>
  ) : null;

  if (!editing && (cards.length < 2 || edges.length === 0)) {
    return (
      <div>
        {editBar}
        {option}
      <p className="text-ink-muted">
        Nothing is linked between boards yet. Use <em>linked to</em> on a variable (or a formula such as{" "}
        <span className="text-accent-2">a = board.b</span>) and the string shows up here.
      </p>
      </div>
    );
  }

  return (
    <div>
    {editBar}
    {option}
    <div ref={boardRef} className="relative">
      <div className="relative z-0 grid grid-cols-1 gap-x-24 gap-y-10 pr-12 md:grid-cols-2 md:pr-0">
        {cards.map((card, i) => {
          const rows = editing ? card.all : card.all.filter((v) => linked.has(v.name));
          const rest = editing ? 0 : card.all.length - rows.length;
          return (
            <section
              key={card.key || "own"}
              className="note"
              style={{ transform: `rotate(${i % 2 === 0 ? -0.8 : 0.9}deg)` }}
            >
              <h3 className="note-title">
                {card.board ? (
                  <a href={`/c/${card.board}`} className="hover:underline">
                    {card.title}
                  </a>
                ) : (
                  card.title
                )}
              </h3>
              <ul className="flex flex-col gap-2">
                {rows.map((v) => (
                  <li
                    key={v.name}
                    ref={(el) => {
                      if (el) rowRefs.current.set(v.name, el);
                      else rowRefs.current.delete(v.name);
                    }}
                    className={`note-row ${editing ? "cursor-pointer hover:bg-black/5" : ""}`}
                    style={picked === v.name ? { outline: "2px solid #c0281f", outlineOffset: 1, background: "rgb(192 40 31 / 0.12)" } : undefined}
                    onClick={() => pick(v.name)}
                  >
                    {flat.labels[v.name] || displayName(card.key ? v.name.slice(card.key.length + 1) : v.name)}
                  </li>
                ))}
              </ul>
              {rest > 0 && <p className="mt-2 text-sm opacity-60">+ {rest} more variable{rest === 1 ? "" : "s"} not linked</p>}
            </section>
          );
        })}
      </div>
      <svg ref={svgRef} className="pointer-events-none absolute left-0 top-0 z-10 overflow-visible" aria-hidden="true">
        {edges.map((edge, i) => (
          <g key={`${edge.a}|${edge.b}`}>
            <path
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              fill="none"
              stroke="#c0281f"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={edge.kind === "formula" ? "7 5" : edge.kind === "shared" ? "2 6" : undefined}
              opacity={edge.kind === "shared" ? 0.85 : 1}
              style={{ filter: "drop-shadow(1px 2px 1.5px rgb(0 0 0 / 0.55))" }}
            />
            {editing && edge.own && (
              <path
                ref={(el) => {
                  hitRefs.current[i] = el;
                }}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={() => cut(edge)}
              >
                <title>Cut this string</title>
              </path>
            )}
            <g
              ref={(el) => {
                pinRefs.current[i] = el;
              }}
            >
              <circle r={6} fill="#e0443a" stroke="#7d130d" strokeWidth={1.5} />
              <circle r={6} fill="#e0443a" stroke="#7d130d" strokeWidth={1.5} />
            </g>
          </g>
        ))}
      </svg>
      <p className="mt-4 text-sm text-ink-muted">
        Solid string: linked with <em>linked to</em>. Dashed: a formula that sets one variable equal to another. Dotted: used in the same formula.
      </p>
    </div>
    </div>
  );
}
