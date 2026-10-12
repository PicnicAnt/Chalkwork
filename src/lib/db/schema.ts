import type Database from "better-sqlite3";

const now = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// The tables, created when the database is first opened. Settings kept per variable are JSON text keyed by variable
// name; a board's lists (tables, collections, presets, drawings, used boards, tags) are JSON arrays.
export function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${now}),
      UNIQUE (provider, account_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (${now}),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      formulas TEXT NOT NULL,
      input_values TEXT NOT NULL,
      variable_descriptions TEXT NOT NULL DEFAULT '{}',
      variable_units TEXT NOT NULL DEFAULT '{}',
      variable_decimals TEXT NOT NULL DEFAULT '{}',
      variable_labels TEXT NOT NULL DEFAULT '{}',
      variable_hidden TEXT NOT NULL DEFAULT '{}',
      variable_ranges TEXT NOT NULL DEFAULT '{}',
      variable_order TEXT NOT NULL DEFAULT '[]',
      variable_types TEXT NOT NULL DEFAULT '{}',
      variable_formats TEXT NOT NULL DEFAULT '{}',
      variable_choices TEXT NOT NULL DEFAULT '{}',
      board_includes TEXT NOT NULL DEFAULT '[]',
      board_tables TEXT NOT NULL DEFAULT '[]',
      board_tags TEXT NOT NULL DEFAULT '[]',
      board_collections TEXT NOT NULL DEFAULT '[]',
      board_presets TEXT NOT NULL DEFAULT '[]',
      visualizations TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'public',
      created_at TEXT NOT NULL DEFAULT (${now}),
      updated_at TEXT NOT NULL DEFAULT (${now})
    );
    CREATE INDEX IF NOT EXISTS boards_owner ON boards(owner_id);

    -- Every saved state of a board, which is its history.
    CREATE TABLE IF NOT EXISTS board_versions (
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      draft TEXT NOT NULL,
      saved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT NOT NULL DEFAULT '',
      saved_at TEXT NOT NULL DEFAULT (${now}),
      PRIMARY KEY (board_id, version)
    );

    -- The picture a board shows in lists, as a data URL. A board without a row gets a plain picture made from its title.
    CREATE TABLE IF NOT EXISTS board_images (
      board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
      image TEXT NOT NULL
    );

    -- The checks of a board: sets of numbers with the results expected, as JSON (see lib/checks.ts).
    CREATE TABLE IF NOT EXISTS board_checks (
      board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
      checks TEXT NOT NULL
    );

    -- How many times each board has been opened by someone other than its owner: the board's popularity.
    CREATE TABLE IF NOT EXISTS board_views (
      board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
      views INTEGER NOT NULL DEFAULT 0
    );

    -- Changes someone else proposes to a board, which its owner approves or rejects. base_stamp is when the board
    -- was last changed at the time, to notice that it has changed since.
    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      draft TEXT NOT NULL,
      base_stamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      decision_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${now}),
      decided_at TEXT
    );
    CREATE INDEX IF NOT EXISTS suggestions_board ON suggestions(board_id);
    CREATE INDEX IF NOT EXISTS suggestions_author ON suggestions(author_id);

    -- A person's saved numbers (and boards) on a board.
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${now})
    );
    CREATE INDEX IF NOT EXISTS scenarios_board_user ON scenarios(board_id, user_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      link TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${now}),
      read_at TEXT
    );
    CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, read_at, created_at);
  `);
}
