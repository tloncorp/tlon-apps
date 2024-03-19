import { drizzle } from 'drizzle-orm/sqlite-proxy';
// @ts-expect-error this is fine.
import { SQLocalDrizzle } from 'sqlocal/drizzle';

const { driver } = new SQLocalDrizzle('tlon.sqlite');

export const db = drizzle(driver);
