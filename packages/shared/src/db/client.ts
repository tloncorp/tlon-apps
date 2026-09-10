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

/**
 * Thrown when a query runs before the platform db layer has called
 * `setClient` — i.e. database setup never completed.
 */
export class DatabaseNotSetError extends Error {
  constructor() {
    super('Database not set.');
    this.name = 'DatabaseNotSetError';
  }
}

let clientInstance: AnySqliteDatabase | null = null;
let didReportMissingClient = false;

/**
 * A missing client is a single startup failure, but every query in the app
 * trips over it. Reporting each one buries the actual setup error under
 * thousands of identical events, so only the first is worth sending.
 */
export function shouldReportQueryError(error: unknown) {
  if (!(error instanceof DatabaseNotSetError)) {
    return true;
  }
  if (didReportMissingClient) {
    return false;
  }
  didReportMissingClient = true;
  return true;
}

export function setClient<T extends AnySqliteDatabase>(client: T) {
  clientInstance = client;
  didReportMissingClient = false;

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
        throw new DatabaseNotSetError();
      }
      return Reflect.get(clientInstance, prop, receiver);
    },
  }
) as AnySqliteDatabase;
