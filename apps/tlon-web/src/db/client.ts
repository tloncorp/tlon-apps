import { setDriver } from '@tloncorp/shared/dist/db';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

const { driver } = new SQLocalDrizzle('tlon.sqlite');

// eslint-disable-next-line import/prefer-default-export
export const db = drizzle(driver);

setDriver(driver);
