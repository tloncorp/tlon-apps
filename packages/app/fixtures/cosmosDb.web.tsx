import * as db from '@tloncorp/shared/db';
import { PropsWithChildren, useEffect, useState } from 'react';

import { useMigrations } from '../lib/baseDb';
import { WebDb } from '../lib/webDb';
import { fixturePosts } from './contentHelpers';
import { group } from './fakeData';

const cosmosDb = new WebDb({ enableStoragePersistence: false });

// Cosmos renders components that read the local SQLite database through the
// statically imported store hooks. Boot the in-memory web database, run
// migrations, and seed it with the shared fixture data so those hooks return
// something. Storage persistence is disabled so fixture data and sync state
// cannot affect the developer's normal web database. No urbit client is
// configured — writes and syncs fail fast, and reads of unseeded data resolve
// empty.
async function seed() {
  try {
    await db.insertGroups({ groups: [group] });
    await db.insertChannelPosts({ posts: fixturePosts });
  } catch (e) {
    console.warn('cosmos: failed to seed fixture data', e);
  }
}

function MigrateAndSeed({ children }: PropsWithChildren) {
  const { success, error } = useMigrations(cosmosDb);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) {
      seed().then(() => setSeeded(true));
    }
  }, [success]);

  if (error) {
    console.warn('cosmos: migrations failed', error);
    return children;
  }
  return seeded ? children : null;
}

export function CosmosDbProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    cosmosDb.setupDb().then(() => setReady(true));
  }, []);

  return ready ? <MigrateAndSeed>{children}</MigrateAndSeed> : null;
}
