"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const noSubscription = () => () => {};

type Input = { name: string; value: string };

// Everything about getting a board out of Chalkwork behind one button: the plain link, a link with the numbers on
// screen, the values as a spreadsheet file, and how to embed the board or call it from code.
export function ShareMenu({
  boardId,
  inputs,
  variables,
  valuesLink,
  onDownloadCsv,
}: {
  boardId: string;
  /** A few real variables with their values, for the examples. */
  inputs: Input[];
  variables: string[];
  /** The address that opens the board with the numbers on screen, written when it is asked for. */
  valuesLink: () => string;
  onDownloadCsv: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const origin = useSyncExternalStore(noSubscription, () => location.origin, () => "");

  // Closes on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setDone(what);
      setTimeout(() => setDone((d) => (d === what ? null : d)), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  const api = `${origin}/api/boards/${boardId}`;
  const query = inputs.map((i) => `${i.name}=${i.value}`).join("&");
  const body = JSON.stringify({ inputs: Object.fromEntries(inputs.map((i) => [i.name, Number(i.value) || i.value])) });
  const item = "block w-full px-3 py-2 text-left text-lg hover:bg-[var(--board-edge)]";

  return (
    <div ref={box} className="relative shrink-0">
      <button type="button" className="btn btn-primary" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Share ▾
      </button>
      {open && (
        <div role="menu" className="sketch-box absolute right-0 z-30 mt-2 flex w-[min(92vw,30rem)] flex-col bg-[var(--board)] py-1 shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => copy("link", `${location.origin}/c/${boardId}`)}>
            {done === "link" ? "Link copied ✓" : "Copy link to this board"}
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => copy("values", valuesLink())} title="A link that opens the board with the numbers on screen">
            {done === "values" ? "Link copied ✓" : "Copy link with these values"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              onDownloadCsv();
              setOpen(false);
            }}
            title="The values on screen as a spreadsheet file"
          >
            Download as CSV
          </button>
          <button type="button" role="menuitem" className={item} aria-expanded={showCode} onClick={() => setShowCode((s) => !s)}>
            Embed or use from code {showCode ? "▴" : "▾"}
          </button>
          {showCode && (
            <div className="flex flex-col gap-3 border-t border-[var(--ink-faint)] px-3 py-3 text-base">
              <div>
                <p className="text-lg">As a web service</p>
                <p className="text-ink-muted">
                  Give some variables (names as shown, such as <code>room.width</code>) and get everything else back as JSON. An output can be an input too.
                </p>
                <pre className="overflow-x-auto py-1 text-sm">{`curl "${api}${query ? `?${query}` : ""}"\n\ncurl -X POST ${api} -H "Content-Type: application/json" -d '${body}'`}</pre>
                <button type="button" className="link" onClick={() => copy("curl", `curl "${api}${query ? `?${query}` : ""}"`)}>
                  {done === "curl" ? "Copied ✓" : "Copy the first command"}
                </button>
                <p className="pt-1 text-ink-muted">Variables: {variables.join(", ")}.</p>
              </div>
              <div>
                <p className="text-lg">In another page</p>
                <pre className="overflow-x-auto py-1 text-sm">{`<iframe src="${origin}/embed/${boardId}?theme=light" width="100%" height="520" style="border:0"></iframe>`}</pre>
                <button type="button" className="link" onClick={() => copy("iframe", `<iframe src="${origin}/embed/${boardId}?theme=light" width="100%" height="520" style="border:0"></iframe>`)}>
                  {done === "iframe" ? "Copied ✓" : "Copy the embed code"}
                </button>
                <p className="pt-1 text-ink-muted">
                  Add <code>?theme=dark</code> or <code>light</code> for the colours, and <code>&amp;state=…</code> from <em>Copy link with these values</em> to start with someone&apos;s numbers.
                </p>
              </div>
              <p className="text-sm text-ink-faint">Boards are public by their link, so the web service and the embed are too.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
