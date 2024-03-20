import {
  drizzle as drizzleSqlLiteProxy,
  RemoteCallback,
} from "drizzle-orm/sqlite-proxy";
import * as schema from "./schemas";

let driver: RemoteCallback;

export function setDriver(inputDriver: RemoteCallback) {
  driver = inputDriver;
}

export const getDatabase = (web?: boolean) => {
  const db = drizzleSqlLiteProxy(driver, { schema });
  return db;
};
