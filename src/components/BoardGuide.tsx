"use client";

import { useState, useSyncExternalStore } from "react";

// A short explanation of how a board works and what its colours mean. It opens by itself the first time
// someone looks at a board in this browser, and can be opened again from the "How does this work?" link.
const KEY = "chalkwork-guide-seen";
const listeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the guide simply shows again next time.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// On the server nothing is known about the browser, so the guide is treated as seen and stays closed.
function useGuideSeen() {
  return useSyncExternalStore(subscribe, readSeen, () => true);
}

export function BoardGuide() {
  const seen = useGuideSeen();
  const [askedFor, setAskedFor] = useState(false);
  const open = askedFor || !seen;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          if (open) {
            markSeen();
            setAskedFor(false);
          } else setAskedFor(true);
        }}
        aria-expanded={open}
        className="link self-start text-base"
      >
        {open ? "Hide the guide" : "How does this work?"}
      </button>
      {open && (
        <div className="sketch-box flex flex-col gap-3 px-4 py-3 text-lg" role="note">
          <p>
            <strong>Type a number anywhere.</strong> Every name in the formulas is a variable, and any of them can be
            changed: a result is as good an input as an input. The others are worked out so that all the formulas
            still hold.
          </p>
          <ul className="flex flex-col gap-2">
            <li>
              <span className="text-locked">150</span> and a closed lock: a value <strong>you typed</strong>. It is kept
              as it is. Press the lock to let the formulas change it again.
            </li>
            <li>
              <span className="border-b-[5px] border-double border-note text-note">42</span> blue with a double
              line: <strong>fixed</strong>. The locked values (or a formula) already decide it, so it can&apos;t be
              typed over. Unlock one of the values it depends on to change it.
            </li>
            <li>
              <span>3.14</span> plain: <strong>worked out</strong> from the others. It changes when they do, and you
              can type over it to lock it.
            </li>
            <li>
              <span className="text-ink-muted">?</span> <strong>no value yet.</strong> Leave it empty and the formulas
              fill it in, or type one.
            </li>
          </ul>
          <button
            type="button"
            onClick={() => {
              markSeen();
              setAskedFor(false);
            }}
            className="btn self-start"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
