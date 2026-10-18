import { describe, expect, it } from "vitest";
import { cleanSvg, defaultImageSvg, parseImage, svgDataUrl } from "@/lib/board-image";
import { imageWith } from "@/lib/ai";

const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="#234"/><circle cx="80" cy="60" r="30" fill="#fc0"/></svg>';

describe("pictures of boards", () => {
  it("keeps a plain SVG and refuses ones that could run or load something", () => {
    expect(cleanSvg(ok)).toBe(ok);
    expect(cleanSvg(ok.replace("<rect", "<script>alert(1)</script><rect"))).toBeNull();
    expect(cleanSvg(ok.replace("<circle", '<circle onclick="x()"'))).toBeNull();
    expect(cleanSvg(ok.replace("<circle", '<image href="https://example.com/a.png"/><circle'))).toBeNull();
    expect(cleanSvg(ok.replace('fill="#fc0"', 'fill="url(https://example.com/x)"'))).toBeNull();
    expect(cleanSvg("not a picture")).toBeNull();
  });

  it("reads a data URL back, and refuses other kinds and sizes", () => {
    expect(parseImage(svgDataUrl(ok))?.mime).toBe("image/svg+xml");
    expect(parseImage("data:image/gif;base64,AAAA")).toBeNull();
    expect(parseImage("data:image/png;base64," + "A".repeat(200_000))).toBeNull();
    expect(parseImage(svgDataUrl("<svg><script></script></svg>"))).toBeNull();
    expect(parseImage(42)).toBeNull();
  });

  it("makes a plain picture from the title and the first drawing", () => {
    const a = defaultImageSvg("Loan payment", "gauge");
    expect(a).toMatch(/^<svg /);
    expect(a).toBe(defaultImageSvg("Loan payment", "gauge"));
    expect(a).not.toBe(defaultImageSvg("Box", "box"));
    expect(cleanSvg(a)).not.toBeNull();
  });

  it("has the helper draw one and checks what it returns", async () => {
    let seen = "";
    const good = await imageWith(async (_s, user) => ((seen = user), `Here it is:\n${ok}`), { title: "Box", description: "", formulas: ["v = w * h * d"] }, cleanSvg);
    expect(good).toEqual({ ok: true, svg: ok });
    expect(seen).toMatch(/Title: Box/);
    const bad = await imageWith(async () => "<svg><script>x</script></svg>", { title: "Box", description: "", formulas: [] }, cleanSvg);
    expect(bad.ok).toBe(false);
  });
});
