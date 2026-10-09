import type Database from "better-sqlite3";

// The schema is versioned with PRAGMA user_version: each step runs once, in order, on a database that is
// behind it. A new column or table is a new step at the end; the old steps are never changed.
export function migrate(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < 2) {
    // Version 1 stored separate inputs/outputs. It only ever held local test data, so start fresh.
    db.exec(`
      DROP TABLE IF EXISTS calculations;
      CREATE TABLE calculations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        formulas TEXT NOT NULL,
        input_values TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  }
  if (version < 3) {
    // Editing used to be done with a secret edit key (edit_key_hash). Ownership by user replaced it
    // in version 8; the column is left in place, unused.
    db.exec(`
      ALTER TABLE calculations ADD COLUMN edit_key_hash TEXT;
      ALTER TABLE calculations ADD COLUMN updated_at TEXT;
    `);
    db.pragma("user_version = 3");
  }
  if (version < 4) {
    // A short description per variable, as JSON keyed by variable name.
    db.exec(`ALTER TABLE calculations ADD COLUMN variable_descriptions TEXT NOT NULL DEFAULT '{}';`);
    db.pragma("user_version = 4");
  }
  if (version < 5) {
    // A unit label per variable, as JSON keyed by variable name.
    db.exec(`ALTER TABLE calculations ADD COLUMN variable_units TEXT NOT NULL DEFAULT '{}';`);
    db.pragma("user_version = 5");
  }
  if (version < 6) {
    // Decimals to show per variable, as JSON keyed by variable name.
    db.exec(`ALTER TABLE calculations ADD COLUMN variable_decimals TEXT NOT NULL DEFAULT '{}';`);
    db.pragma("user_version = 6");
  }
  if (version < 7) {
    // A display name per variable, as JSON keyed by variable name.
    db.exec(`ALTER TABLE calculations ADD COLUMN variable_labels TEXT NOT NULL DEFAULT '{}';`);
    db.pragma("user_version = 7");
  }
  if (version < 8) {
    // Users, their login sessions, and the owner of each calculation. A user is identified by the
    // sign-in provider that vouched for them ("dev" for the test login, later "google") and that
    // provider's own id for them. Calculations made before this have no owner (owner_id is NULL):
    // anyone can view them, nobody can edit them, and anyone signed in can copy them.
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (provider, account_id)
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);
      ALTER TABLE calculations ADD COLUMN owner_id TEXT REFERENCES users(id);
      CREATE INDEX calculations_owner ON calculations(owner_id);
    `);
    db.pragma("user_version = 8");
  }
  if (version < 9) {
    // Which variables are hidden from the board, as JSON keyed by variable name.
    db.exec(`ALTER TABLE calculations ADD COLUMN variable_hidden TEXT NOT NULL DEFAULT '{}';`);
    db.pragma("user_version = 9");
  }
  if (version < 10) {
    // The boards a board uses, as JSON: [{ "board": id, "alias": name }].
    db.exec(`ALTER TABLE calculations ADD COLUMN board_includes TEXT NOT NULL DEFAULT '[]';`);
    db.pragma("user_version = 10");
  }
  if (version < 11) {
    // Variables linked to another variable, as JSON: { "variable": "other variable" }.
    db.exec(`ALTER TABLE calculations ADD COLUMN variable_links TEXT NOT NULL DEFAULT '{}';`);
    db.pragma("user_version = 11");
  }
  if (version < 12) {
    // Suggested changes: another user proposes a new version of a board (the draft, as JSON) that the
    // owner approves or rejects. base_stamp is when the board was last changed at the time, to notice
    // that it has changed since.
    db.exec(`
      CREATE TABLE suggestions (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        draft TEXT NOT NULL,
        base_stamp TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        decision_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        decided_at TEXT
      );
      CREATE INDEX suggestions_board ON suggestions(board_id);
      CREATE INDEX suggestions_author ON suggestions(author_id);
    `);
    db.pragma("user_version = 12");
  }
  if (version < 13) {
    // Decimals are numbers. Some boards (made by the seed script) held them as text, which made a
    // suggestion look like it changed a decimal from "2" to 2.
    const rows = db.prepare("SELECT id, variable_decimals FROM calculations").all() as { id: string; variable_decimals: string }[];
    const fix = db.prepare("UPDATE calculations SET variable_decimals = ? WHERE id = ?");
    for (const row of rows) {
      const parsed = JSON.parse(row.variable_decimals || "{}") as Record<string, unknown>;
      if (!Object.values(parsed).some((v) => typeof v === "string")) continue;
      const fixed = Object.fromEntries(
        Object.entries(parsed).flatMap(([k, v]) => (Number.isFinite(Number(v)) && v !== "" ? [[k, Number(v)]] : [])),
      );
      fix.run(JSON.stringify(fixed), row.id);
    }
    db.pragma("user_version = 13");
  }
  if (version < 14) {
    // Drawings that follow a board's variables, as JSON: [{ "type": "rectangle", "map": { "width": "w" } }].
    db.exec(`ALTER TABLE calculations ADD COLUMN visualizations TEXT NOT NULL DEFAULT '[]';`);
    db.pragma("user_version = 14");
  }
  if (version < 15) {
    // Scenarios: a named set of values for a board, saved by a user for themselves. The snapshot is JSON:
    // { "values": { name: text }, "locked": [names] }.
    db.exec(`
      CREATE TABLE scenarios (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX scenarios_board_user ON scenarios(board_id, user_id);
    `);
    db.pragma("user_version = 15");
  }
  if (version < 16) {
    // The history of a board: every save is kept as a numbered version (the draft, as JSON). The boards that
    // exist now get their current state as version 1.
    db.exec(`
      CREATE TABLE board_versions (
        board_id TEXT NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        draft TEXT NOT NULL,
        saved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (board_id, version)
      );
    `);
    const boards = db.prepare("SELECT * FROM calculations").all() as Record<string, string | null>[];
    const keep = db.prepare("INSERT INTO board_versions (board_id, version, draft, saved_by, saved_at) VALUES (?, 1, ?, ?, COALESCE(?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))");
    for (const b of boards) {
      const json = (text: string | null, fallback: string) => JSON.parse(text || fallback);
      const draft = {
        title: b.title,
        description: b.description,
        formulas: json(b.formulas, "[]"),
        values: json(b.input_values, "{}"),
        descriptions: json(b.variable_descriptions, "{}"),
        units: json(b.variable_units, "{}"),
        labels: json(b.variable_labels, "{}"),
        hidden: json(b.variable_hidden, "{}"),
        decimals: json(b.variable_decimals, "{}"),
        includes: json(b.board_includes, "[]"),
        links: json(b.variable_links, "{}"),
        visualizations: json(b.visualizations, "[]"),
      };
      keep.run(b.id, JSON.stringify(draft), b.owner_id, b.updated_at, b.created_at);
    }
    db.pragma("user_version = 16");
  }
}
