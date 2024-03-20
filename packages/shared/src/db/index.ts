import * as schema from './schemas';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { drizzle as drizzleSqlLiteProxy } from 'drizzle-orm/sqlite-proxy';
import { drizzle as drizzleExpoSqlLite } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite/next';

const sqliteFile = 'tlon.sqlite';
const { driver } = new SQLocalDrizzle(sqliteFile);
const expoDriver = openDatabaseSync(sqliteFile);

const openDatabaseWeb = () => {
  const db = drizzleSqlLiteProxy(driver, { schema });

  return db;
};

const openDatabaseExpo = () => {
  const db = drizzleExpoSqlLite(expoDriver, { schema });

  return db;
};

export const getDatabase = (web?: boolean) => {
  if (web) {
    return openDatabaseWeb();
  }

  return openDatabaseExpo();
};
