import type { OPSQLiteConnection } from '@op-engineering/op-sqlite';
import { open } from '@op-engineering/op-sqlite';
import type { Schema } from '@tloncorp/shared/dist/db';
import { schema, setClient } from '@tloncorp/shared/dist/db';
import { migrations } from '@tloncorp/shared/dist/db/migrations';
import type { OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import { useEffect, useMemo, useState } from 'react';

let connection: OPSQLiteConnection | null = null;
let client: OPSQLiteDatabase<Schema> | null = null;

export function setupDb() {
  if (connection || client) {
    console.warn('setupDb called multiple times, ignoring');
    return;
  }
  connection = open({ location: 'default', name: 'tlon.sqlite' });
  client = drizzle(connection, {
    schema,
  });
  setClient(client);
  console.log('SQLite database opened at', connection.getDbPath());
}

export async function purgeDb() {
  if (!connection) {
    console.warn('purgeDb called before setupDb, ignoring');
    return;
  }
  console.log('purging sqlite database');
  connection.close();
  connection.delete();
  connection = null;
  client = null;
  console.log('purged sqlite database, recreating');
  setupDb();
}

export function getDbPath() {
  return connection?.getDbPath();
}

export function useMigrations() {
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('running migrations');
    const startTime = Date.now();
    runMigrations()
      .then(() => setHasSucceeded(true))
      .catch((e) => {
        console.log('failed to migrate database', e);
        setError(e);
      })
      .finally(() =>
        console.log('migrations complete in', Date.now() - startTime + 'ms')
      );
  }, []);

  return useMemo(
    () => ({
      success: hasSucceeded,
      error: error,
    }),
    [hasSucceeded, error]
  );
}

async function runMigrations() {
  try {
    await migrate(client!, migrations);
    return;
  } catch (e) {
    console.log('migrations failed, purging db and retrying', e);
  }
  await purgeDb();
  await migrate(client!, migrations);
  console.log("migrations succeeded after purge, shouldn't happen often");
}
