import {
  drizzle as drizzleSqlLiteProxy,
  RemoteCallback,
  SqliteRemoteDatabase
} from 'drizzle-orm/sqlite-proxy';
import {
  drizzle as drizzleExpoSqlLite,
  ExpoSQLiteDatabase
} from 'drizzle-orm/expo-sqlite';
import { SQLiteDatabase } from 'expo-sqlite/next';
import * as schema from './schemas';

let driver: RemoteCallback | SQLiteDatabase;

// Type guards to discriminate the driver
function isSQLiteDatabase(
  driver: RemoteCallback | SQLiteDatabase
): driver is SQLiteDatabase {
  return (driver as SQLiteDatabase).isInTransactionAsync !== undefined;
}

function isRemoteCallback(
  driver: RemoteCallback | SQLiteDatabase
): driver is RemoteCallback {
  return !isSQLiteDatabase(driver);
}

export function setDriver(inputDriver: RemoteCallback | SQLiteDatabase) {
  driver = inputDriver;
}

export const getDatabase = () => {
  let db:
    | ExpoSQLiteDatabase<typeof schema>
    | SqliteRemoteDatabase<typeof schema>;
  if (isRemoteCallback(driver)) {
    db = drizzleSqlLiteProxy(driver, { schema });
  } else {
    db = drizzleExpoSqlLite(driver, { schema });
  }
  return db;
};
