import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// One SQLite file shared by all demos; each demo owns its own tables (prefix = slug).
// Server-only. Import from route handlers / server actions, never from client components.
// On Vercel the deployment filesystem is read-only except /tmp, and /tmp is per serverless instance
// (not shared, wiped on cold start), so demo data there is best-effort. Use Postgres/Turso for real persistence.
const file =
  process.env.DEMO_DB_PATH ??
  (process.env.VERCEL ? "/tmp/demos.db" : path.join(process.cwd(), "data", "demos.db"));

const g = globalThis as unknown as { __demoDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__demoDb) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const d = new DatabaseSync(file);
    d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    g.__demoDb = d;
  }
  return g.__demoDb;
}

// Run fn inside a transaction (rolls back on throw).
export function tx<T>(fn: (d: DatabaseSync) => T): T {
  const d = db();
  // IMMEDIATE takes the write lock up front so concurrent writers wait (busy_timeout) instead of failing mid-transaction.
  d.exec("BEGIN IMMEDIATE");
  try {
    const r = fn(d);
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
