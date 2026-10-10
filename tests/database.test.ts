import Database from "better-sqlite3";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backupDatabase, backupIfDue, listBackups } from "@/lib/db/backup";
import { migrate } from "@/lib/db/migrations";

// Files are removed after each test; on Windows a database must be closed first.
const dirs: string[] = [];
const open: Database.Database[] = [];
const database = (file: string) => {
  const db = new Database(file);
  open.push(db);
  return db;
};
afterEach(() => {
  while (open.length) open.pop()?.close();
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "chalkwork-test-"));
  dirs.push(dir);
  return dir;
};

describe("the database schema", () => {
  it("is built from nothing, up to the latest version, with every table", () => {
    const db = new Database(":memory:");
    migrate(db);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["calculations", "users", "sessions", "suggestions"]));
    expect(db.pragma("user_version", { simple: true })).toBeGreaterThanOrEqual(14);
  });

  it("has the columns and tables for ranges, tables, tags and notifications", () => {
    const db = new Database(":memory:");
    migrate(db);
    const columns = (db.pragma("table_info(calculations)") as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(["variable_ranges", "board_tables", "board_tags"]));
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["notifications"]));
  });

  it("can be run again without changing anything", () => {
    const db = new Database(":memory:");
    migrate(db);
    const version = db.pragma("user_version", { simple: true });
    migrate(db);
    expect(db.pragma("user_version", { simple: true })).toBe(version);
  });

  it("turns decimals saved as text into numbers", () => {
    const db = new Database(":memory:");
    db.pragma("user_version = 12");
    db.exec(`CREATE TABLE calculations (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, formulas TEXT NOT NULL, input_values TEXT NOT NULL,
      created_at TEXT, edit_key_hash TEXT, updated_at TEXT, variable_descriptions TEXT NOT NULL DEFAULT '{}', variable_units TEXT NOT NULL DEFAULT '{}',
      variable_decimals TEXT NOT NULL DEFAULT '{}', variable_labels TEXT NOT NULL DEFAULT '{}', owner_id TEXT, variable_hidden TEXT NOT NULL DEFAULT '{}',
      board_includes TEXT NOT NULL DEFAULT '[]', variable_links TEXT NOT NULL DEFAULT '{}');
      CREATE TABLE users (id TEXT PRIMARY KEY, provider TEXT, account_id TEXT, name TEXT);
      CREATE TABLE suggestions (id TEXT PRIMARY KEY);`);
    db.prepare("INSERT INTO calculations (id, title, description, formulas, input_values, variable_decimals) VALUES ('a', 't', '', '[]', '{}', ?)").run('{"x":"2","y":3}');
    migrate(db);
    const row = db.prepare("SELECT variable_decimals AS d FROM calculations WHERE id = 'a'").get() as { d: string };
    expect(JSON.parse(row.d)).toEqual({ x: 2, y: 3 });
  });
});

describe("backups", () => {
  it("copies the database, content and all", async () => {
    const dir = tempDir();
    const db = database(path.join(dir, "live.db"));
    db.exec("CREATE TABLE t (n INTEGER); INSERT INTO t VALUES (42);");
    const file = await backupDatabase(db, path.join(dir, "backups"));
    expect(existsSync(file)).toBe(true);
    const copy = database(file);
    expect((copy.prepare("SELECT n FROM t").get() as { n: number }).n).toBe(42);
  });

  it("keeps only the newest few", async () => {
    const dir = tempDir();
    const db = database(path.join(dir, "live.db"));
    db.exec("CREATE TABLE t (n INTEGER)");
    for (let i = 0; i < 5; i++) await backupDatabase(db, path.join(dir, "backups"), 3, new Date(2026, 0, 1, 0, 0, i));
    expect(listBackups(path.join(dir, "backups"))).toHaveLength(3);
  });

  it("only makes a new one when the newest is old", async () => {
    const dir = tempDir();
    const db = database(path.join(dir, "live.db"));
    db.exec("CREATE TABLE t (n INTEGER)");
    const backups = path.join(dir, "backups");
    expect(await backupIfDue(db, backups)).not.toBeNull();
    expect(await backupIfDue(db, backups)).toBeNull();
    // A zero age can race the file's own timestamp, so ask for a copy no matter how recent the last is.
    expect(await backupIfDue(db, backups, -60_000)).not.toBeNull();
  });
});

describe("the history of a board", () => {
  it("gives every board that exists its current state as version 1", () => {
    const db = new Database(":memory:");
    migrate(db);
    // Go back to before the history existed, with a board in the database.
    db.exec("DROP TABLE board_versions");
    db.pragma("user_version = 15");
    db.prepare("INSERT INTO calculations (id, title, description, formulas, input_values) VALUES ('b1', 'Rectangle', 'd', ?, ?)").run('["area = w * h"]', '{"w":"3"}');
    migrate(db);
    const rows = db.prepare("SELECT version, draft FROM board_versions WHERE board_id = 'b1'").all() as { version: number; draft: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
    const draft = JSON.parse(rows[0].draft);
    expect(draft.title).toBe("Rectangle");
    expect(draft.formulas).toEqual(["area = w * h"]);
    expect(draft.values).toEqual({ w: "3" });
    expect(draft.includes).toEqual([]);
  });

  it("goes with the board when it is deleted", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db);
    db.prepare("INSERT INTO calculations (id, title, description, formulas, input_values) VALUES ('b1', 't', '', '[]', '{}')").run();
    db.prepare("INSERT INTO board_versions (board_id, version, draft) VALUES ('b1', 1, '{}')").run();
    db.prepare("DELETE FROM calculations WHERE id = 'b1'").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM board_versions").get()).toEqual({ n: 0 });
  });
});
