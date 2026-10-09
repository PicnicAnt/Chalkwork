// Getting things out of a board as files: tables as CSV and drawings or charts as images. Used by the buttons
// that say "Download CSV" and "Save image". Only the CSV part is pure; the rest needs a browser.

// Rows of text as CSV that opens in a spreadsheet: quotes where needed, and a mark at the start so Excel reads
// accents and symbols (m², µ, €) correctly.
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadCsv = (filename: string, rows: (string | number | null | undefined)[][]) =>
  downloadBlob(filename, new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));

// A file name made from a title: letters and digits, lower case, dashes between words.
export const fileNameOf = (title: string, fallback = "chalkwork") =>
  title
    // Letters that don't break into a letter and an accent.
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || fallback;

// The picture as a PNG. The drawings use the page's colour variables, which an image drawn on its own can't
// see, so they are written out as the colours they have now, and the board's colour goes behind the picture.
export async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const root = getComputedStyle(document.documentElement);
  const resolve = (text: string) =>
    text.replace(/var\((--[a-z0-9-]+)(?:,[^)]*)?\)/gi, (_, name: string) => root.getPropertyValue(name).trim() || "currentColor");
  const copy = svg.cloneNode(true) as SVGSVGElement;
  for (const el of [copy, ...copy.querySelectorAll<SVGElement>("*")]) {
    for (const attr of [...el.attributes]) if (attr.value.includes("var(")) el.setAttribute(attr.name, resolve(attr.value));
    const style = el.getAttribute("style");
    if (style?.includes("var(")) el.setAttribute("style", resolve(style));
  }
  const box = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || box.width;
  const height = viewBox.height || box.height;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  const markup = new XMLSerializer().serializeToString(copy);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((done, fail) => {
      image.onload = () => done();
      image.onerror = () => fail(new Error("The picture could not be drawn."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas.");
    ctx.fillStyle = root.getPropertyValue("--board").trim() || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error("No image."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
