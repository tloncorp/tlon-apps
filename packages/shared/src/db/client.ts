import type { QueryResult } from '@op-engineering/op-sqlite';
import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { SqliteRemoteResult } from 'drizzle-orm/sqlite-proxy';

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

export function setClient<T extends AnySqliteDatabase>(client: T) {
  clientInstance = client;

  if (__DEV__) {
    const exec = (strings: TemplateStringsArray, ...values: any[]) =>
      (client as any).$client.execute(strings.join('?'), values);
    const execSimple = (strings: TemplateStringsArray, ...values: any[]) => {
      const result = exec(strings, ...values);
      return Array(result.rows.length)
        .fill(0)
        .map((_, i) => result.rows.item(i));
    };
    Object.assign(global, {
      __db: client,
      __sql: execSimple,
      __sqlRaw: exec,
    });
  }
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
