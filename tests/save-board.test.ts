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
  types: { width: "boolean" },
  formats: { area: "currency" },
  presets: [{ name: "Wide", values: { width: "9" }, locked: ["width"] }],
  includes: [],
  visualizations: [],
  ...over,
});

describe("saving a board", () => {
  it("stores a new board and every later change to it", () => {
    const user = api.upsertUser({ provider: "test", accountId: "a", name: "Tester" });
    const id = api.insertBoard(draft(), user.id);
    expect(api.getBoard(id)).toMatchObject({ title: "Rectangle", types: { width: "boolean" }, formats: { area: "currency" }, collections: [{ name: "gear", stats: ["strength"] }], presets: [{ name: "Wide", values: { width: "9" }, locked: ["width"] }], ranges: { width: { min: 1, max: 9 } }, tags: ["geometry"], order: ["height", "width"] });

    const changed = draft({ title: "Changed", ranges: { height: { min: 2 } }, tags: ["a", "b"], order: ["width", "height"], tables: [] });
    expect(api.saveBoard(id, user.id, changed, "test")).toBe(true);
    expect(api.getBoard(id)).toMatchObject({ title: "Changed", ranges: { height: { min: 2 } }, tags: ["a", "b"], order: ["width", "height"], tables: [] });
    expect(api.listVersions(id).length).toBe(2);
    // Someone else can't change it.
    expect(api.saveBoard(id, "other", draft({ title: "Mine now" }))).toBe(false);
  });
});

describe("listing boards for a viewer", () => {
  it("leaves out private and link-only boards that are not the viewer's own", () => {
    const owner = api.upsertUser({ provider: "test", accountId: "owner", name: "Owner" });
    const other = api.upsertUser({ provider: "test", accountId: "other", name: "Other" });
    const make = (title: string, visibility: "public" | "link" | "private") => api.insertBoard(draft({ title, visibility }), owner.id);
    make("Listed", "public");
    make("Link only", "link");
    make("Secret", "private");
    const titles = (viewer?: string) => api.listAllBoards(1000, viewer).map((b) => b.title);
    expect(titles(other.id)).toEqual(expect.arrayContaining(["Listed"]));
    expect(titles(other.id)).not.toContain("Link only");
    expect(titles(other.id)).not.toContain("Secret");
    expect(titles(owner.id)).toEqual(expect.arrayContaining(["Listed", "Link only", "Secret"]));
    expect(titles()).not.toContain("Secret");
  });
});

describe("boards saved when variables could be linked", () => {
  it("get each link as a formula when the database is upgraded", async () => {
    const { db } = await import("@/lib/db/client");
    const { migrate } = await import("@/lib/db/migrations");
    const user = api.upsertUser({ provider: "test", accountId: "links", name: "Linker" });
    const id = api.insertBoard(draft({ title: "Linked", formulas: ["a = b * 2", "c = 1"] }), user.id);
    db.prepare("UPDATE calculations SET variable_links = ? WHERE id = ?").run(JSON.stringify({ c: "b" }), id);
    db.pragma("user_version = 27");
    migrate(db);
    expect(api.getBoard(id)?.formulas).toEqual(["a = b * 2", "c = 1", "c = b"]);
    expect(db.prepare("SELECT variable_links FROM calculations WHERE id = ?").get(id)).toEqual({ variable_links: "{}" });
  });
});
