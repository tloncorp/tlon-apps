// ref https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/migrator.ts

/* eslint no-param-reassign: 0 */
import { sql } from 'drizzle-orm';
import type { MigrationMeta } from 'drizzle-orm/migrator';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

import Migration0000 from '../drizzle/0000_swift_thunderball.sql?raw';
import journal from '../drizzle/meta/_journal.json';

const migrations: MigrationMeta[] = [
  {
    sql: Migration0000.split('--> statement-breakpoint'),
    bps: journal.entries[0].breakpoints,
    folderMillis: journal.entries[0].when,
    hash: '',
  },
];

async function digestMessage(message: string) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(''); // convert bytes to hex string
  return hashHex;
}

async function populateHashes() {
  migrations.forEach(async (migration) => {
    migration.hash = await digestMessage(migration.sql.join(''));
  });
}

// ref https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/sqlite-core/dialect.ts#L615
export default async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteRemoteDatabase<TSchema>
) {
  populateHashes();

  const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)
		`;
  await db.run(migrationTableCreate);

  const dbMigrations = await db.values<[number, string, string]>(
    sql`SELECT id, hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`
  );

  const lastDbMigration = dbMigrations[0] ?? undefined;
  await db.run(sql`BEGIN`);

  try {
    migrations.forEach(async (migration) => {
      if (
        !lastDbMigration ||
        Number(lastDbMigration[2])! < migration.folderMillis
      ) {
        migration.sql.forEach(async (stmt) => {
          await db.run(sql.raw(stmt));
        });
        await db.run(
          sql`INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
        );
      }
    });

    await db.run(sql`COMMIT`);
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
}
