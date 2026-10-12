import { vizIcon } from "./viz-icons";

// The picture a board shows in lists. A person can upload one or have the helper draw one; a board with none gets a
// plain picture made from its title and first drawing. Stored as a data URL.

export const IMAGE_LIMITS = { bytes: 120_000, svgBytes: 24_000 };

const KINDS = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"] as const;

// Text that has no place in a picture: scripts, handlers, other documents, things loaded from elsewhere.
const FORBIDDEN = /<\s*(script|foreignObject|iframe|object|embed|image|use|style|link|a)\b|\bon[a-z]+\s*=|javascript:|data:|https?:|@import|url\s*\(\s*['"]?\s*(?!#)/i;

// The SVG as safe markup, or null when it isn't a picture we keep.
export function cleanSvg(text: string): string | null {
  const svg = text.trim();
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;
  // The namespace declaration is an address too, so it is set aside before looking for addresses.
  const probe = svg.replace(/\sxmlns(:\w+)?="[^"]*"/gi, "");
  if (svg.length > IMAGE_LIMITS.svgBytes || FORBIDDEN.test(probe)) return null;
  return svg;
}

export type StoredImage = { mime: (typeof KINDS)[number]; bytes: Buffer };

// A data URL read back as what it holds, or null when it isn't an acceptable picture.
export function parseImage(dataUrl: unknown): StoredImage | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:([a-z+/]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = KINDS.find((k) => k === m[1]);
  if (!mime) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > IMAGE_LIMITS.bytes) return null;
  if (mime === "image/svg+xml") {
    const clean = cleanSvg(bytes.toString("utf8"));
    return clean ? { mime, bytes: Buffer.from(clean, "utf8") } : null;
  }
  return { mime, bytes };
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

const hash = (text: string) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// The picture for a board with none: a coloured tile from its title, with the outline of its first drawing.
export function defaultImageSvg(title: string, firstDrawing?: string): string {
  const hue = hash(title) % 360;
  const icon = vizIcon(firstDrawing ?? "board");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="hsl(${hue} 38% 24%)"/><rect width="160" height="120" fill="hsl(${(hue + 40) % 360} 50% 40%)" fill-opacity="0.25"/><g transform="translate(40 30) scale(1.6)" color="hsl(${hue} 60% 88%)">${icon}</g></svg>`;
}
