import { PropsWithChildren, useEffect, useState } from 'react';

import { useMigrations } from '../lib/baseDb';
import { NativeDb } from '../lib/nativeDb';
import { seedCosmosDb } from './cosmosDbSeed';

const cosmosDb = new NativeDb({
  databaseName: 'tlon-cosmos.sqlite',
  resetSyncStateOnPurge: false,
});

// Cosmos renders components that read the local SQLite database through
// statically imported store hooks. Use a dedicated database so fixture data
// and migration recovery cannot affect the developer's normal app database.
function MigrateAndSeed({ children }: PropsWithChildren) {
  const { success, error } = useMigrations(cosmosDb);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) {
      seedCosmosDb().then(() => setSeeded(true));
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
