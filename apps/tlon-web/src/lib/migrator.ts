import { createDevLogger } from '@tloncorp/shared';
import { migrations as sharedMigrations } from '@tloncorp/shared/src/db';
import { sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

const logger = createDevLogger('migrator', true);

export default async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteRemoteDatabase<TSchema>,
  migrationConfig: typeof sharedMigrations
) {
  const { journal, migrations } = migrationConfig;

  logger.log('Migrating database', { db, journal, migrations });


  try {
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT,
      created_at TEXT
    )
  `);

    logger.log('Created migrations table');

    const appliedMigrations = await db.values<[number, string, string]>(
      sql`SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`
    );

    logger.log('Applied migrations', appliedMigrations);
    const appliedMigrationHashes = new Set(appliedMigrations.map((m) => m[1]));
    logger.log('Applied migration hashes', appliedMigrationHashes);

    for (const entry of journal.entries) {
      logger.log('Checking migration', entry);
      // tag looks like this "0000_swift_yellow_claw"
      // we only want the hash part
      const migrationHash = entry.tag.split('_').slice(1).join('_');
      if (!appliedMigrationHashes.has(migrationHash)) {
        const migrationSql = migrations[migrationHash];
        if (migrationSql) {
          try {
            await db.run(sql.raw(migrationSql));
            logger.log(`Applied migration ${migrationHash}`);

            // Record migration as applied
            await db.run(sql`
          INSERT INTO __drizzle_migrations (hash, created_at)
          VALUES (${migrationHash}, datetime('now'))
        `);
            logger.log(`Recorded migration ${migrationHash}`);
          } catch (e) {
            logger.error(`Error applying migration ${migrationHash}`, e);
            throw e;
          }
        } else {
          console.warn(`Migration SQL not found for hash: ${migrationHash}`);
        }
      }
    }

    logger.log('Database migration complete');
  } catch (e) {
    logger.error('Error migrating database', e);
    throw e;
  }
}
