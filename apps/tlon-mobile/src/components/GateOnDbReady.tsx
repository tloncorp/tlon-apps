import { setupDb } from '@tloncorp/app/lib/nativeDb';
import { PropsWithChildren, useEffect, useState } from 'react';

export function GateOnDbReady({ children }: PropsWithChildren) {
  const [isDbReady, setIsDbReady] = useState(false);
  useEffect(() => {
    async function checkDb() {
      await setupDb();
      setIsDbReady(true);
    }
    checkDb();
  }, []);

  return isDbReady ? children : null;
}
