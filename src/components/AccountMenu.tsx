"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

// The signed-in person's name as one button, styled like the board switch used to be. It opens the account options:
// switching between whiteboard and blackboard, and signing out.
export function AccountMenu({ name, signOut }: { name: string; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={box} className="relative">
      <button type="button" className="btn max-w-[11rem] truncate px-3 py-1 text-base sm:max-w-[16rem]" aria-haspopup="true" aria-expanded={open} title={name} onClick={() => setOpen((o) => !o)}>
        {name} ▾
      </button>
      {open && (
        <div role="menu" className="sketch-box absolute right-0 z-30 mt-2 flex min-w-[12rem] flex-col items-stretch gap-1 bg-[var(--board)] px-2 py-2 shadow-lg">
          <ThemeToggle />
          <form action={signOut} className="contents">
            <button type="submit" className="btn px-3 py-1 text-base">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
