"use client";

import { useSyncExternalStore } from "react";
import { CollapsibleSection } from "./ui/CollapsibleSection";

const noSubscription = () => () => {};

// How to use a board from outside Chalkwork: as a web service that other tools can call, and as a frame to put
// in a page. The examples use the board's own variable names.
export function ApiHint({ boardId, inputs, variables }: { boardId: string; inputs: { name: string; value: string }[]; variables: string[] }) {
  const origin = useSyncExternalStore(noSubscription, () => location.origin, () => "");
  const api = `${origin}/api/boards/${boardId}`;
  const query = inputs.map((i) => `${i.name}=${i.value}`).join("&");
  const body = JSON.stringify({ inputs: Object.fromEntries(inputs.map((i) => [i.name, Number(i.value) || i.value])) });

  return (
    <CollapsibleSection
      title="Use this board elsewhere"
      description="Anything the board works out can be asked for from other tools or other sites. Boards are public by their link, so this is too."
    >
      <div className="flex flex-col gap-3 text-base">
        <div>
          <p className="text-lg">As a web service</p>
          <p className="text-ink-muted">
            Give some variables (names as shown, such as <code>room.width</code>) and get everything else back as JSON.
            An output can be an input too.
          </p>
          <pre className="sketch-box overflow-x-auto px-3 py-2 text-sm">{`curl "${api}${query ? `?${query}` : ""}"\n\ncurl -X POST ${api} -H "Content-Type: application/json" -d '${body}'`}</pre>
          <p className="text-ink-muted">Variables: {variables.join(", ")}.</p>
        </div>
        <div>
          <p className="text-lg">In another page</p>
          <pre className="sketch-box overflow-x-auto px-3 py-2 text-sm">{`<iframe src="${origin}/embed/${boardId}?theme=light" width="100%" height="520" style="border:0"></iframe>`}</pre>
          <p className="text-ink-muted">
            Add <code>?theme=dark</code> or <code>light</code> for the colours, and <code>&amp;state=…</code> from{" "}
            <em>Copy link with these values</em> to start with someone&apos;s numbers.
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
}
