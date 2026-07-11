import * as db from '@tloncorp/shared/db';
import { PropsWithChildren, useEffect, useState } from 'react';

import { setupDb, useMigrations } from '../lib/webDb';
import { group } from './fakeData';

// Cosmos renders components that read the local SQLite database through the
// statically imported store hooks. Boot the (in-memory) database, run
// migrations, and seed it with the shared fixture data so those hooks return
// something. No urbit client is configured — writes and syncs fail fast, and
// reads of unseeded data resolve empty.
async function seed() {
  try {
    await db.insertGroups({ groups: [group] });
  } catch (e) {
    console.warn('cosmos: failed to seed fixture data', e);
  }
}

function MigrateAndSeed({ children }: PropsWithChildren) {
  const { success, error } = useMigrations();
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
    setupDb().then(() => setReady(true));
  }, []);

  return ready ? <MigrateAndSeed>{children}</MigrateAndSeed> : null;
}
