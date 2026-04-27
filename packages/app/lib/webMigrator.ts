import { createDevLogger } from '@tloncorp/shared';
import { migrations as sharedMigrations } from '@tloncorp/shared/db/migrations';
import { sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

const logger = createDevLogger('migrator', false);

async function runWithRetry<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000,
  operationName: string
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Operation ${operationName} timed out`)),
            5000
          )
        ),
      ]);
    } catch (error) {
      logger.warn(
        `Attempt ${i + 1} failed for operation ${operationName}:`,
        error
      );
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`All retries failed for operation ${operationName}`);
}

async function testDatabaseConnection(
  db: SqliteRemoteDatabase<Record<string, unknown>>
) {
  logger.log('Testing database connection');
  try {
    await runWithRetry(
      () => db.run(sql`SELECT 1`),
      3,
      1000,
      'Test database connection'
    );
    logger.log('Database connection successful');
  } catch (error) {
    logger.error('Database connection test failed:', error);
    throw error;
  }
}

async function getDatabaseInfo(sqlocal: SQLocalDrizzle) {
  logger.log('Fetching database info');
  try {
    const info = await sqlocal.getDatabaseInfo();
    logger.log('Database info:', info);
    return info;
  } catch (error) {
    logger.error('Failed to fetch database info:', error);
    throw error;
  }
}

function normalizeCreateSql(statement: string) {
  return statement
    .trim()
    .replace(/;$/, '')
    .replace(/[`"]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getCreatedObject(statement: string) {
  const match = statement.match(
    /^CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([^`"\s(]+)/i
  );
  if (!match) {
    return null;
  }

  return {
    type: match[1].toLowerCase(),
    name: match[2],
  };
}

async function existingCreateMatches(
  db: SqliteRemoteDatabase<Record<string, unknown>>,
  statement: string
) {
  const createdObject = getCreatedObject(statement);
  if (!createdObject) {
    return false;
  }

  const existing = await db.values<[string | null]>(
    sql`SELECT sql FROM sqlite_master WHERE type = ${createdObject.type} AND name = ${createdObject.name} LIMIT 1`
  );
  const existingSql = existing[0]?.[0];

  return (
    existingSql != null &&
    normalizeCreateSql(existingSql) === normalizeCreateSql(statement)
  );
}

export default async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteRemoteDatabase<TSchema>,
  migrationConfig: typeof sharedMigrations,
  sqlocal: SQLocalDrizzle,
  {
    dryRun = false,
  }: {
    /** If true, does not apply the migrations (but *will* create the `__drizzle_migrations` table). */
    dryRun?: boolean;
  } = {}
): Promise<{
  /** migration tags that were applied (or would be applied on dry run) */
  applied: string[];
}> {
  const { journal, migrations } = migrationConfig;

  logger.log('Migrating database', { db, journal, migrations });

  try {
    await testDatabaseConnection(db);
    await getDatabaseInfo(sqlocal);
    logger.log('Creating migrations table if not exists');

    await runWithRetry(
      () =>
        db.run(sql`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT,
          created_at TEXT
        )
      `),
      3,
      1000,
      'Create migrations table'
    );

    logger.log('Migrations table created or already exists');

    logger.log('Fetching applied migrations');
    const appliedMigrations = await runWithRetry(
      () =>
        db.values<[number, string, string]>(
          sql`SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`
        ),
      3,
      1000,
      'Fetch applied migrations'
    );

    logger.log('Applied migrations', appliedMigrations);
    const appliedMigrationHashes = new Set(appliedMigrations.map((m) => m[1]));
    logger.log('Applied migration hashes', appliedMigrationHashes);

    const out = { applied: [] as string[] };

    for (const entry of journal.entries) {
      logger.log('Checking migration', entry);
      const migrationKey = `m${entry.tag.split('_').slice(0, 1).join('_')}`;
      // NB: We previously used `migrationKey` as the `hash` column - we've
      // changed to use the entire tag ('0000_swift_yellow_claw').
      const migrationHash = entry.tag;
      logger.log('Checking migration hash', migrationHash);
      if (!appliedMigrationHashes.has(migrationHash)) {
        const migrationSql = migrations[migrationKey];
        if (migrationSql) {
          let failed = false;

          if (!dryRun) {
            // Split on drizzle's statement-breakpoint markers so each
            // DDL runs independently. We tolerate "already exists"
            // errors per statement — the generated SQL uses plain CREATE
            // (not CREATE IF NOT EXISTS), and when `reset-migrations`
            // rotates the tag, an existing DB would otherwise throw on
            // the first CREATE TABLE and leave the migration un-recorded,
            // causing it to retry (and fail) on every reload.
            const statements = migrationSql
              .split('--> statement-breakpoint')
              .map((s) => s.trim())
              .filter((s) => s.length > 0);

            for (const statement of statements) {
              try {
                await db.run(sql.raw(statement));
              } catch (e) {
                const msg = (
                  e instanceof Error ? e.message : String(e)
                ).toLowerCase();
                if (
                  msg.includes('already exists') &&
                  (await existingCreateMatches(db, statement))
                ) {
                  // Schema object already present with the same definition;
                  // expected when the migration tag rotated but the DB is up
                  // to date. If it differs, fail so the caller can purge/retry.
                  continue;
                }
                logger.error(
                  `Unexpected error applying statement in ${migrationHash}`,
                  e,
                  statement
                );
                failed = true;
                // keep going — don't let one statement abort the rest;
                // the final "record as applied" is gated on !failed.
              }
            }

            if (!failed) {
              try {
                await db.run(sql`
          INSERT INTO __drizzle_migrations (hash, created_at)
          VALUES (${migrationHash}, datetime('now'))
        `);
                logger.log(`Recorded migration ${migrationHash}`);
              } catch (e) {
                logger.error(`Failed to record migration ${migrationHash}`, e);
                failed = true;
              }
            }
          }
          if (!failed) {
            out.applied.push(migrationHash);
          }
        } else {
          console.warn(
            `Migration SQL not found for tag: ${migrationHash} (key: ${migrationKey})`
          );
        }
      }
    }

    logger.log('Database migration complete');
    return out;
  } catch (e) {
    logger.error('Error migrating database', e);
    throw e;
  }
}
