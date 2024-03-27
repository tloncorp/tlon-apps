import type { OPSQLiteConnection } from '@op-engineering/op-sqlite';
import { open } from '@op-engineering/op-sqlite';
import type { Schema } from '@tloncorp/shared/dist/db';
import { schema, setClient } from '@tloncorp/shared/dist/db';
import migrations from '@tloncorp/shared/dist/drizzle/migrations';
import type { OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { useMigrations as baseUseMigrations } from 'drizzle-orm/op-sqlite/migrator';
import { useEffect, useRef } from 'react';

let connection: OPSQLiteConnection | null = null;
let client: OPSQLiteDatabase<Schema> | null = null;

export function setupDb() {
  if (connection || client) {
    console.warn('setupDb called multiple times, ignoring');
    return;
  }
  connection = open({ location: 'default', name: 'tlon.sqlite' });
  connection.updateHook((a) => {
    console.log('update', a);
  });
  client = drizzle(connection, {
    schema,
  });
  setClient(client);
  console.log('SQLite database opened at', connection.getDbPath());
}

export async function purgeDb() {
  // This shouldn't ever be called in production, but just in case...
  if (process.env.NODE_ENV === 'production') {
    console.log('Refusing to purge database in production');
    return;
  }
  console.log('purging database');
  if (!connection) {
    console.warn('purgeDb called before setupDb, ignoring');
    return;
  }
  console.log('purging sqlite database');
  connection.delete();
  connection.close();
  console.log('purged sqlite database');
}

export function useMigrations() {
  const startTime = useRef(Date.now());
  const result = baseUseMigrations(client!, migrations);
  useEffect(() => {
    console.log('running migrations');
  }, []);
  useEffect(() => {
    if (result.success) {
      console.log(
        'migrations complete in',
        Date.now() - startTime.current + 'ms'
      );
    }
  }, [result.success]);
  useEffect(() => {
    if (result.error) {
      console.error('migrations failed', result.error);
    }
  }, [result.error]);
  return result;
}
