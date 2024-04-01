import type { QueryResult } from "@op-engineering/op-sqlite";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { SqliteRemoteResult } from "drizzle-orm/sqlite-proxy";

import { Schema } from "./types";

// Should work for OPSQLiteBase, BetterSqlite3Database, and SQLiteRemoteDabase
// Doesn't work with a union as there are type conflicts in the drizzle internals.
export type AnySqliteDatabase = BaseSQLiteDatabase<
  "async",
  SqliteRemoteResult | QueryResult,
  Schema
>;

let clientInstance: AnySqliteDatabase | null = null;

export function setClient<T extends AnySqliteDatabase>(client: T) {
  clientInstance = client;
}

export const client = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!clientInstance) {
        throw new Error("Database not set.");
      }
      return Reflect.get(clientInstance, prop, receiver);
    },
  }
) as AnySqliteDatabase;
