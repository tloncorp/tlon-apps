import { ensureDbReady } from '@tloncorp/app/lib/nativeDb';
import { useEffect, useState } from 'react';

const MAX_DB_READY_ATTEMPTS = 3;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useDbReady() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbInitError, setDbInitError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initDb() {
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= MAX_DB_READY_ATTEMPTS; attempt++) {
        try {
          await ensureDbReady();
          if (!cancelled) {
            setIsDbReady(true);
          }
          return;
        } catch (error) {
          lastError = error;
          if (attempt < MAX_DB_READY_ATTEMPTS && !cancelled) {
            await wait(500 * attempt);
          }
        }
      }

      if (!cancelled) {
        setDbInitError(lastError);
      }
    }

    void initDb();

    return () => {
      cancelled = true;
    };
  }, []);

  return { dbInitError, isDbReady };
}
