"use client";

import { useState, type RefObject } from "react";
import { downloadBlob, fileNameOf, svgToPng } from "@/lib/export";

// "Save image" under a drawing or a chart: the picture in front of it, as a PNG.
export function SaveImageButton({ target, name }: { target: RefObject<HTMLElement | null>; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="link self-end text-base"
      onClick={async () => {
        const svg = target.current?.querySelector<SVGSVGElement>("svg[role=img]");
        if (!svg) return;
        try {
          setFailed(false);
          downloadBlob(`${fileNameOf(name)}.png`, await svgToPng(svg));
        } catch {
          setFailed(true);
        }
      }}
    >
      {failed ? "Couldn't save the image" : "Save image"}
    </button>
  );
}
