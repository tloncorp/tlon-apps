import { PropsWithChildren, useEffect, useState } from 'react';

import { setupDb, useMigrations } from '../lib/nativeDb';

// Cosmos renders components that read the local SQLite database through the
// statically imported store hooks. On native, cosmos runs inside the dev
// client and setupDb opens the app's persistent database — so run migrations
// to make it readable, but don't seed fixture data into it (a dev session's
// real data lives there). The web variant seeds its in-memory database.
function Migrate({ children }: PropsWithChildren) {
  const { success, error } = useMigrations();

  if (error) {
    console.warn('cosmos: migrations failed', error);
    return children;
  }
  return success ? children : null;
}

export function CosmosDbProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setupDb().then(() => setReady(true));
  }, []);

  return ready ? <Migrate>{children}</Migrate> : null;
}
