import * as schema from './schemas';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { drizzle as drizzleSqlLiteProxy } from 'drizzle-orm/sqlite-proxy';
import { drizzle as drizzleExpoSqlLite } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite/next';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const sqliteFile = 'tlon.sqlite';

const openDatabaseWeb = () => {
  const { driver } = new SQLocalDrizzle(sqliteFile);

  const db = drizzleSqlLiteProxy(driver, { schema });

  return db;
};

const openDatabaseExpo = () => {
  const driver = openDatabaseSync(sqliteFile);

  const db = drizzleExpoSqlLite(driver, { schema });

  return db;
};

export const getDatabase = (web?: boolean) => {
  if (web) {
    return openDatabaseWeb();
  }

  return openDatabaseExpo();
};
