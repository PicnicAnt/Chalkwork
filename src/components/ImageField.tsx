"use client";

import { useRef, useState, useTransition } from "react";
import { drawBoardImage } from "@/app/actions/ai";

const MAX_SIDE = 480;
const MAX_CHARS = 150_000;

// Reads a picture file, scales it down to fit and returns it as a data URL small enough to keep.
async function fromFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't scale pictures.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < MAX_CHARS) return url;
  }
  throw new Error("That picture is too detailed to keep. Try a smaller one.");
}

// The picture a board shows in lists: upload a file, have the helper draw one, or remove it (a plain one is then
// made from the board's title). `value` is a data URL, or empty for none.
export function ImageField({
  value,
  currentSrc,
  onChange,
  aiEnabled,
  describe,
}: {
  value: string;
  /** What is shown while there is no new picture: the board's current one. */
  currentSrc?: string;
  onChange: (image: string) => void;
  aiEnabled: boolean;
  /** What the helper draws from. */
  describe: () => { title: string; description: string; formulas: string[] };
}) {
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = value || currentSrc || "";

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded border-2 border-[var(--ink-faint)] text-sm text-ink-muted">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="The picture of the board" className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center">A plain picture is made from the title</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <button type="button" className="btn" onClick={() => file.current?.click()}>
            Upload a picture
          </button>
          {aiEnabled && (
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const out = await drawBoardImage(describe());
                  if (out.ok) onChange(out.image);
                  else setError(out.error);
                })
              }
            >
              {pending ? "Drawing…" : "Draw one with the helper"}
            </button>
          )}
          {(value || currentSrc) && (
            <button type="button" className="link text-base text-danger" onClick={() => onChange("")}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (!picked) return;
            try {
              setError(null);
              onChange(await fromFile(picked));
            } catch (problem) {
              setError(problem instanceof Error ? problem.message : "That file couldn't be read as a picture.");
            }
          }}
        />
        <p className="text-sm text-ink-muted">Shown next to the title in lists. It is saved when you save the board.</p>
        {error && <p className="text-danger">{error}</p>}
      </div>
    </div>
  );
}
