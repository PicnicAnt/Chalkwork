"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// The board-shaped frame around every page, with the header on top. A board that is embedded in another site
// (/embed/...) is shown without it.
export function SiteFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  const embedded = usePathname().startsWith("/embed");
  if (embedded) return <main className="w-full px-3 py-3">{children}</main>;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-2 py-3 sm:px-4 sm:py-6">
      <div className="board flex flex-1 flex-col">
        <header className="relative flex flex-col gap-3 px-4 pt-4 sm:px-8 sm:pt-6">{header}</header>
        <main className="relative w-full flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
