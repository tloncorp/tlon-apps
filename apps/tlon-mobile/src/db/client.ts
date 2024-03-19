import { drizzle } from 'drizzle-orm/expo-sqlite'
import { openDatabaseSync } from 'expo-sqlite/next';

const expoDb = openDatabaseSync('tlon.sqlite');

export const db = drizzle(expoDb);

