import { setupDb } from '@tloncorp/app/lib/nativeDb';
import { PropsWithChildren, useEffect, useState } from 'react';

export function GateOnDbReady({
  children,
  inMemory = false,
}: PropsWithChildren<{ inMemory?: boolean }>) {
  const [isDbReady, setIsDbReady] = useState(false);
  useEffect(() => {
    async function checkDb() {
      await setupDb(inMemory);
      setIsDbReady(true);
    }
    checkDb();
  }, [inMemory]);

  return isDbReady ? children : null;
}
