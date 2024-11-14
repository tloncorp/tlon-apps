import { open } from '@op-engineering/op-sqlite';
import { createDevLogger, escapeLog } from '@tloncorp/shared';
import { handleChange, schema, setClient } from '@tloncorp/shared/db';
import { AnySqliteDatabase } from '@tloncorp/shared/db';
import { useEffect, useMemo, useState } from 'react';

import { OPSQLite$SQLiteConnection } from './opsqliteConnection';
import { SQLiteConnection } from './sqliteConnection';

let connection: SQLiteConnection | null = null;
let client: AnySqliteDatabase | null = null;

const enableLogger = false;
const logger = createDevLogger('db', enableLogger);

export function setupDb() {
  if (connection || client) {
    logger.warn('setupDb called multiple times, ignoring');
    return;
  }
  connection = new OPSQLite$SQLiteConnection(
    // NB: the iOS code in SQLiteDB.swift relies on this path - if you change
    // this, you should change that too.
    open({ location: 'default', name: 'tlon.sqlite' })
  );
  // Experimental SQLite settings. May cause crashes. More here:
  // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
  connection.execute('PRAGMA mmap_size=268435456');
  connection.execute('PRAGMA journal_mode=MEMORY');
  connection.execute('PRAGMA synchronous=OFF');

  connection.updateHook(handleChange);

  client = connection.createClient({
    schema,
    logger: enableLogger
      ? {
          logQuery(query, params) {
            logger.log(escapeLog(query), params);
          },
        }
      : undefined,
  });
  setClient(client);
  logger.log('SQLite database opened at', connection.getDbPath());
}

export async function purgeDb() {
  if (!connection) {
    logger.warn('purgeDb called before setupDb, ignoring');
    return;
  }
  logger.log('purging sqlite database');
  connection.close();
  connection.delete();
  connection = null;
  client = null;
  logger.log('purged sqlite database, recreating');
  setupDb();
}

export function getDbPath() {
  return connection?.getDbPath();
}

export function useMigrations() {
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    logger.log('running migrations');
    const startTime = Date.now();
    runMigrations()
      .then(() => setHasSucceeded(true))
      .catch((e) => {
        logger.log('failed to migrate database', e);
        setError(e);
      })
      .finally(() =>
        logger.log('migrations complete in', Date.now() - startTime + 'ms')
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
    await connection?.migrateClient(client!);
    return;
  } catch (e) {
    logger.log('migrations failed, purging db and retrying', e);
  }
  await purgeDb();
  await connection?.migrateClient(client!);
  logger.log("migrations succeeded after purge, shouldn't happen often");
}

export async function resetDb() {
  await purgeDb();
  await connection?.migrateClient(client!);
}
