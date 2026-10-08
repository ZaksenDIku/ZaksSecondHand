import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

// An absolute path (optionally prefixed with `file:`) is used verbatim, which is
// what tests do to get their own throwaway database. A bare filename is resolved
// inside ./data so nothing is traced outside the project directory.
const RAW_URL = process.env.DATABASE_URL?.replace(/^file:/, "");
const DB_PATH =
  RAW_URL && path.isAbsolute(RAW_URL)
    ? RAW_URL
    : path.join(/* turbopackIgnore: true */ process.cwd(), "data", RAW_URL || "zaks.sqlite");

declare global {
  var __zaksDb: BetterSQLite3Database<typeof schema> | undefined;
  var __zaksMigrated: boolean | undefined;
}

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  if (!global.__zaksMigrated) {
    migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    global.__zaksMigrated = true;
  }
  return db;
}

export const db: BetterSQLite3Database<typeof schema> = global.__zaksDb ?? createDb();
if (process.env.NODE_ENV !== "production") global.__zaksDb = db;

export * as schema from "./schema";
