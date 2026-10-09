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
    expect(await backupIfDue(db, backups, 0)).not.toBeNull();
  });
});
