import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { BoardDraft } from "@/lib/board-draft";

vi.mock("server-only", () => ({}));

// Saving a board against a real database file: a new board, then changes to it with every field filled in.
const dir = mkdtempSync(path.join(tmpdir(), "chalkwork-save-"));
let api: typeof import("@/lib/db");

beforeAll(async () => {
  process.env.CHALKWORK_DATA_DIR = dir;
  process.env.CHALKWORK_BACKUP = "0";
  api = await import("@/lib/db");
});
afterAll(() => {
  // Windows keeps the file locked until the connection is closed.
  void import("@/lib/db/client").then((c) => c.db.close()).finally(() => rmSync(dir, { recursive: true, force: true }));
});

const draft = (over: Partial<BoardDraft> = {}): BoardDraft => ({
  title: "Rectangle",
  description: "d",
  formulas: ["area = width * height"],
  values: { width: "3", height: "4" },
  descriptions: {},
  units: { width: "m" },
  hidden: {},
  labels: {},
  decimals: { area: 1 },
  ranges: { width: { min: 1, max: 9 } },
  tables: [{ name: "curve", mode: "linear", rows: [[0, 0], [1, 1]] }],
  order: ["height", "width"],
  tags: ["geometry"],
  collections: [{ name: "gear", stats: ["strength"] }],
  presets: [{ name: "Wide", values: { width: "9" }, locked: ["width"] }],
  includes: [],
  links: {},
  visualizations: [],
  ...over,
});

describe("saving a board", () => {
  it("stores a new board and every later change to it", () => {
    const user = api.upsertUser({ provider: "test", accountId: "a", name: "Tester" });
    const id = api.insertBoard(draft(), user.id);
    expect(api.getBoard(id)).toMatchObject({ title: "Rectangle", collections: [{ name: "gear", stats: ["strength"] }], presets: [{ name: "Wide", values: { width: "9" }, locked: ["width"] }], ranges: { width: { min: 1, max: 9 } }, tags: ["geometry"], order: ["height", "width"] });

    const changed = draft({ title: "Changed", ranges: { height: { min: 2 } }, tags: ["a", "b"], order: ["width", "height"], tables: [] });
    expect(api.saveBoard(id, user.id, changed, "test")).toBe(true);
    expect(api.getBoard(id)).toMatchObject({ title: "Changed", ranges: { height: { min: 2 } }, tags: ["a", "b"], order: ["width", "height"], tables: [] });
    expect(api.listVersions(id).length).toBe(2);
    // Someone else can't change it.
    expect(api.saveBoard(id, "other", draft({ title: "Mine now" }))).toBe(false);
  });
});
