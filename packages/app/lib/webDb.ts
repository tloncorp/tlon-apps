import { createDevLogger } from '@tloncorp/shared';
import type { Schema } from '@tloncorp/shared/db';
import { handleChange, schema, setClient } from '@tloncorp/shared/db';
import { migrations } from '@tloncorp/shared/db/migrations';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { useEffect, useMemo, useState } from 'react';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import migrate from './webMigrator';
import { TRIGGER_SETUP } from './webTriggers';

const POLL_INTERVAL = 100;

let sqlocal: SQLocalDrizzle | null = null;
let client: ReturnType<typeof drizzle<Schema>> | null = null;

const enableLogger = false;
const logger = createDevLogger('db', enableLogger);

export async function setupDb() {
  if (sqlocal || client) {
    logger.warn('setupDb called multiple times, ignoring');
    return;
  }
  try {
    sqlocal = new SQLocalDrizzle({
      databasePath: 'tlon.sqlite',
      verbose: enableLogger,
    });

    logger.log('sqlocal instance created', { sqlocal });
    // Experimental SQLite settings. May cause crashes. More here:
    // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
    await sqlocal.sql('PRAGMA mmap_size=268435456');
    // await sqlocal.sql('PRAGMA journal_mode=MEMORY');
    await sqlocal.sql('PRAGMA synchronous=OFF');
    await sqlocal.sql('PRAGMA journal_mode=WAL');

    const { driver } = sqlocal;

    client = drizzle(driver, {
      schema,
      logger: enableLogger
        ? {
            logQuery(query, params) {
              logger.log(query, params);
            },
          }
        : undefined,
    });

    const dbInfo = await sqlocal.getDatabaseInfo();
    logger.log('SQLite database opened:', dbInfo);

    setClient(client);
  } catch (e) {
    logger.error('Failed to setup SQLite db', e);
  }
}

export async function checkDb() {
  if (!sqlocal) {
    logger.warn('checkDb called before setupDb, ignoring');
    return;
  }
  const dbInfo = await sqlocal.getDatabaseInfo();
  logger.log('SQLite database info:', dbInfo);
  return dbInfo;
}

let isPolling = false;

function startChangePolling() {
  if (isPolling) return;
  isPolling = true;
  pollChanges();
}

const changeLogTable = sqliteTable('__change_log', {
  id: integer('id').primaryKey(),
  table_name: text('table_name').notNull(),
  operation: text('operation').notNull(),
  row_id: integer('row_id'),
  row_data: text('row_data'),
  timestamp: integer('timestamp').default(sql`(strftime('%s', 'now'))`),
});

async function pollChanges() {
  if (!client) return;

  try {
    const changes = await client.select().from(changeLogTable).all();

    for (const change of changes) {
      handleChange({
        table: change.table_name,
        operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
        row: JSON.parse(change.row_data ?? ''),
      });
    }

    // Clear processed changes
    await client.delete(changeLogTable).run();
  } catch (error) {
    console.error('Error polling changes:', error);
  } finally {
    // Schedule next poll
    setTimeout(pollChanges, POLL_INTERVAL); // Poll every second
  }
}

export async function purgeDb() {
  if (!sqlocal) {
    logger.warn('purgeDb called before setupDb, ignoring');
    return;
  }
  logger.log('purging sqlite database');
  sqlocal.destroy();
  sqlocal = null;
  client = null;
  logger.log('purged sqlite database, recreating');
  await setupDb();
}

export async function getDbPath() {
  return sqlocal?.getDatabaseInfo().then((info) => info.databasePath);
}

export function useMigrations() {
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function performMigrations() {
      logger.log('running migrations');
      const startTime = Date.now();

      try {
        await runMigrations();
        setHasSucceeded(true);
        logger.log('migrations complete in', Date.now() - startTime + 'ms');
      } catch (e) {
        logger.log('failed to migrate database', e);
        setError(e);
      }
    }

    performMigrations();
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
  if (!client || !sqlocal) {
    logger.warn('runMigrations called before setupDb, ignoring');
    return;
  }

  try {
    logger.log('runMigrations: starting migration');
    await migrate<Schema>(client, migrations, sqlocal);
    logger.log('runMigrations: migrations succeeded');
    await sqlocal.sql(TRIGGER_SETUP);
    startChangePolling();
    return;
  } catch (e) {
    logger.log('migrations failed, purging db and retrying', e);
  }
  await purgeDb();
  await migrate(client, migrations, sqlocal);
  logger.log("migrations succeeded after purge, shouldn't happen often");
}

export async function resetDb() {
  await purgeDb();
  await migrate(client!, migrations, sqlocal!);
}
