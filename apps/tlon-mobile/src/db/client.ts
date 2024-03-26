import { open } from '@op-engineering/op-sqlite';
import { schemas, setClient } from '@tloncorp/shared/dist/db';
import { drizzle } from 'drizzle-orm/op-sqlite';

const rawDb = open({ location: 'default', name: 'tlon.sqlite' });

export const db = drizzle(rawDb, {
  schema: schemas,
});

setClient(db);
