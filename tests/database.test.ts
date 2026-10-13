import Database from "better-sqlite3";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backupDatabase, backupIfDue, listBackups } from "@/lib/db/backup";
import { createSchema } from "@/lib/db/schema";

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
  it("is built from nothing with every table", () => {
    const db = new Database(":memory:");
    createSchema(db);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["boards", "board_versions", "users", "sessions", "suggestions", "scenarios"]));
  });

  it("can be run again without changing anything", () => {
    const db = new Database(":memory:");
    createSchema(db);
    db.prepare("INSERT INTO users (id, provider, account_id, name) VALUES ('u', 'test', 'a', 'A')").run();
    createSchema(db);
    expect(db.prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({ n: 1 });
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
  it("goes with the board when it is deleted", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    createSchema(db);
    db.prepare("INSERT INTO users (id, provider, account_id, name) VALUES ('u', 'test', 'a', 'A')").run();
    db.prepare("INSERT INTO boards (id, owner_id, title, description, formulas, input_values) VALUES ('b1', 'u', 't', '', '[]', '{}')").run();
    db.prepare("INSERT INTO board_versions (board_id, version, draft) VALUES ('b1', 1, '{}')").run();
    db.prepare("DELETE FROM boards WHERE id = 'b1'").run();
    expect(db.prepare("SELECT COUNT(*) AS n FROM board_versions").get()).toEqual({ n: 0 });
  });
});
