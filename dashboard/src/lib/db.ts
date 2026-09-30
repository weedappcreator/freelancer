/**
 * SQLite connection — reads the same DB as the CLI agents locally.
 * On Vercel (no native modules), returns a lightweight stub that
 * returns empty results. Real-time data comes via /api/heartbeat SSE.
 */

interface StubStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): unknown;
}

interface DbLike {
  prepare(sql: string): StubStatement;
  exec(sql: string): void;
  pragma(s: string): void;
}

let db: DbLike;

function createStub(): DbLike {
  const stmt: StubStatement = {
    all() { return []; },
    get() { return { count: 0, total: 0 }; },
    run() { return {}; },
  };
  return {
    prepare() { return stmt; },
    exec() {},
    pragma() {},
  };
}

export function getDb(): DbLike {
  if (db) return db;

  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const path = require("path");
    const fs = require("fs");
    const Database = require("better-sqlite3");

    const DB_PATH =
      process.env.DB_PATH ||
      path.resolve(process.cwd(), "..", "data", "freelance-revenue-os.db");

    if (fs.existsSync(DB_PATH)) {
      db = new Database(DB_PATH, { readonly: true });
      (db as DbLike).pragma("journal_mode = WAL");
    } else {
      db = createStub();
    }
  } catch {
    // Native module unavailable (Vercel serverless) — use stub
    db = createStub();
  }

  return db;
}
