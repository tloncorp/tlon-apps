import type { QueryResult } from '@op-engineering/op-sqlite';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { SqliteRemoteResult } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import { Schema } from './types';

// Should work for OPSQLiteBase, BetterSqlite3Database, and SQLiteRemoteDabase
// Doesn't work with a union as there are type conflicts in the drizzle internals.
export type AnySqliteDatabase = BaseSQLiteDatabase<
  'async',
  SqliteRemoteResult | QueryResult,
  Schema
>;

// Is there a better way???
export type AnySqliteTransaction = Parameters<
  Parameters<AnySqliteDatabase['transaction']>[0]
>[0];

let clientInstance: AnySqliteDatabase | null = null;
let sqlocalInstance: SQLocalDrizzle | null = null;

export function setClient<T extends AnySqliteDatabase>(client: T) {
  clientInstance = client;
}

export function setSqlocal(sqlocal: SQLocalDrizzle) {
  sqlocalInstance = sqlocal;
}

export const client = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!clientInstance) {
        throw new Error('Database not set.');
      }
      return Reflect.get(clientInstance, prop, receiver);
    },
  }
) as AnySqliteDatabase;

export const sqlocal = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!sqlocalInstance) {
        return undefined;
      }
      return Reflect.get(sqlocalInstance, prop, receiver);
    },
  }
) as SQLocalDrizzle;
