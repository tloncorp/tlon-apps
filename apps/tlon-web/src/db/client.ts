import { setDriver } from '@tloncorp/shared/dist/db';
import { SQLocalDrizzle } from '@tloncorp/sqlocal/drizzle';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

const { driver } = new SQLocalDrizzle('tlon.sqlite');

const db = drizzle(driver);

setDriver(driver);

export { db };
