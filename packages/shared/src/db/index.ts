import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { Schema } from "./types";

type AnySqliteDatabase =
  | BetterSQLite3Database<Schema>
  | SqliteRemoteDatabase<Schema>;
let db: AnySqliteDatabase = null;

export function setDb<T extends AnySqliteDatabase>(newDb: T) {
  db = newDb;
}

export const getDatabase = (): SqliteRemoteDatabase<Schema> => {
  return db as unknown as SqliteRemoteDatabase<Schema>;
};

export * as schemas from "./schemas";

export * from "./types";
