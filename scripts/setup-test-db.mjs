#!/usr/bin/env node
/**
 * Local test database bootstrap (used by scripts/auth-e2e.mjs).
 *
 *  1. Connects to the `postgres` maintenance DB on $DATABASE_URL,
 *  2. Creates the target database if it doesn't exist,
 *  3. Applies every migration in drizzle/*.sql in order. The migrations are
 *     idempotent, so re-running this is always safe.
 *
 * Usage: DATABASE_URL=postgresql://postgres@127.0.0.1:5433/postgres node scripts/setup-test-db.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = new URL(process.env.DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5433/postgres");
const dbName = decodeURIComponent(url.pathname.replace(/^\//, "")) || "quiztime";
const withDb = (name) => {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
};

// 1) Create the target database (connect to the maintenance db first).
const admin = new pg.Client({ connectionString: withDb("postgres") });
await admin.connect();
const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
if (exists.rowCount === 0) {
  await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  console.log(`created database "${dbName}"`);
} else {
  console.log(`database "${dbName}" already exists`);
}
await admin.end();

// 2) Apply migrations in filename order.
const client = new pg.Client({ connectionString: withDb(dbName) });
await client.connect();
const dir = join(root, "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) await client.query(trimmed);
  }
  console.log(`applied ${file}`);
}
await client.end();
console.log("test database ready");
