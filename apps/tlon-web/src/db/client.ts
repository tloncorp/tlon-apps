import { schemas, setDb } from '@tloncorp/shared/dist/db';
import { SQLocalDrizzle } from '@tloncorp/sqlocal/drizzle';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

const { driver } = new SQLocalDrizzle('tlon.sqlite');

// eslint-disable-next-line import/prefer-default-export
export const db = drizzle(driver, { schema: schemas });

setDb(db);
