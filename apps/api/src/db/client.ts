import { mkdirSync } from "node:fs";
import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { MIGRATIONS_DIR } from "../paths";
import * as schema from "./schema";

export type Database = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

/** Opens (or creates) the SQLite database and brings its schema up to date. */
export function createDatabase(databasePath: string): Database {
  const inMemory = databasePath === ":memory:";
  if (!inMemory) mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new BetterSqlite3(databasePath);
  // SQLite leaves foreign keys (and so ON DELETE CASCADE) off unless asked, per connection.
  sqlite.pragma("foreign_keys = ON");
  if (!inMemory) sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}
