import { createDevLogger, escapeLog } from '@tloncorp/shared';
import type { Schema } from '@tloncorp/shared/dist/db';
import { handleChange, schema, setClient } from '@tloncorp/shared/dist/db';
import { migrations } from '@tloncorp/shared/dist/db/migrations';
import { sql } from 'drizzle-orm';
// import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { useEffect, useMemo, useState } from 'react';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import migrate from './migrator';

const POLL_INTERVAL = 100;

let sqlocal: SQLocalDrizzle | null = null;
let client: ReturnType<typeof drizzle<Schema>> | null = null;

const enableLogger = true;
const logger = createDevLogger('db', enableLogger);

const TRIGGER_SETUP = `
-- Create the change_log table
CREATE TABLE IF NOT EXISTS __change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    row_id INTEGER,
    row_data TEXT,
    timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Create trigger for posts table
CREATE TRIGGER IF NOT EXISTS after_posts_change
AFTER INSERT OR UPDATE OR DELETE ON posts
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'posts',
        CASE
            WHEN NEW.id IS NULL THEN 'DELETE'
            WHEN OLD.id IS NULL THEN 'INSERT'
            ELSE 'UPDATE'
        END,
        CASE
            WHEN NEW.id IS NULL THEN OLD.id
            ELSE NEW.id
        END,
        CASE
            WHEN NEW.id IS NULL THEN json_object('id', OLD.id, 'channel_id', OLD.channel_id)
            ELSE json_object('id', NEW.id, 'channel_id', NEW.channel_id, 'parent_id', NEW.parent_id)
        END
    );
END;

-- Create trigger for post_reactions table
CREATE TRIGGER IF NOT EXISTS after_post_reactions_change
AFTER INSERT OR UPDATE OR DELETE ON post_reactions
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'post_reactions',
        CASE
            WHEN NEW.id IS NULL THEN 'DELETE'
            WHEN OLD.id IS NULL THEN 'INSERT'
            ELSE 'UPDATE'
        END,
        CASE
            WHEN NEW.id IS NULL THEN OLD.id
            ELSE NEW.id
        END,
        json_object('id', COALESCE(NEW.id, OLD.id), 'post_id', COALESCE(NEW.post_id, OLD.post_id))
    );
END;

-- Create trigger for thread_unreads table
CREATE TRIGGER IF NOT EXISTS after_thread_unreads_change
AFTER INSERT OR UPDATE OR DELETE ON thread_unreads
BEGIN
    INSERT INTO __change_log (table_name, operation, row_id, row_data)
    VALUES (
        'thread_unreads',
        CASE
            WHEN NEW.id IS NULL THEN 'DELETE'
            WHEN OLD.id IS NULL THEN 'INSERT'
            ELSE 'UPDATE'
        END,
        CASE
            WHEN NEW.id IS NULL THEN OLD.id
            ELSE NEW.id
        END,
        json_object('id', COALESCE(NEW.id, OLD.id), 'thread_id', COALESCE(NEW.thread_id, OLD.thread_id))
    );
END;
`;

export function setupDb() {
  if (sqlocal || client) {
    logger.warn('setupDb called multiple times, ignoring');
    return;
  }
  sqlocal = new SQLocalDrizzle({
    databasePath: 'tlon.sqlite',
    verbose: enableLogger,
  });

  logger.log({ sqlocal });
  // Experimental SQLite settings. May cause crashes. More here:
  // https://ospfranco.notion.site/Configuration-6b8b9564afcc4ac6b6b377fe34475090
  // await sqlocal.sql('PRAGMA mmap_size=268435456');
  // await sqlocal.sql('PRAGMA journal_mode=MEMORY');
  // await sqlocal.sql('PRAGMA synchronous=OFF');

  // sqlocal.updateHook(handleChange);

  const { driver } = sqlocal;

  client = drizzle(driver, {
    schema,
    logger: enableLogger
      ? {
          logQuery(query, params) {
            logger.log(escapeLog(query), params);
          },
        }
      : undefined,
  });

  // const dbInfo = await sqlocal.getDatabaseInfo();
  // logger.log('SQLite database opened:', dbInfo);

  // await sqlocal.sql(TRIGGER_SETUP);

  setClient(client);

  logger.log('SQLite database opened');

  startChangePolling();
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
  setupDb();
}

export async function getDbPath() {
  return sqlocal?.getDatabaseInfo().then((info) => info.databasePath);
}

export function useMigrations() {
  const [hasSucceeded, setHasSucceeded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getDbInfo = async () => {
      if (!sqlocal) {
        logger.warn('getDbInfo called before setupDb, ignoring');
        return;
      }
      const dbInfo = await sqlocal.getDatabaseInfo();

      logger.log({ dbInfo });
    };

    logger.log('running migrations');
    const startTime = Date.now();
    getDbInfo();
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
  if (!client || !sqlocal) {
    logger.warn('runMigrations called before setupDb, ignoring');
    return;
  }

  try {
    await migrate<Schema>(client, migrations);
    const groups = await client.query.groups.findMany();
    logger.log('migrations succeeded', groups.length, 'groups');
    return;
  } catch (e) {
    logger.log('migrations failed, purging db and retrying', e);
  }
  await purgeDb();
  await migrate(client, migrations);
  logger.log("migrations succeeded after purge, shouldn't happen often");
}

export async function resetDb() {
  await purgeDb();
  await migrate(client!, migrations);
}
