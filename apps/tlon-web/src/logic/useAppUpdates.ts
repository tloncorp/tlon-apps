import { createContext, useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import useKilnState, { usePike } from '@/state/kiln';

const CHECK_FOR_UPDATES_INTERVAL = 10 * 60 * 1000; // 10 minutes

function useServiceWorker() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (!r) {
        return;
      }

      setInterval(async () => {
        if (r.installing || !navigator) {
          return;
        }

        if ('connection' in navigator && !navigator.onLine) {
          return;
        }

        const resp = await fetch(swUrl, {
          cache: 'no-store',
          headers: {
            cache: 'no-store',
            'cache-control': 'no-cache',
          },
        });

        if (resp?.status === 200) {
          await r.update();
        }
      }, CHECK_FOR_UPDATES_INTERVAL);
    },
  });

  return { needRefresh, updateServiceWorker };
}

export default function useAppUpdates() {
  const { needRefresh, updateServiceWorker } = useServiceWorker();
  const pike = usePike('groups');

  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [initialHash, setInitialHash] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      useKilnState.getState().fetchPikes();
    }, CHECK_FOR_UPDATES_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pike) {
      if (!initialHash) {
        setInitialHash(pike.hash);
      } else if (initialHash !== pike.hash && !needsUpdate) {
        // wait 5 minutes before showing the update prompt in case there
        // are multiple updates in quick succession
        setTimeout(() => setNeedsUpdate(true), 5 * 60 * 1000);
      }
    }
  }, [pike, initialHash, needsUpdate]);

  const triggerUpdate = useCallback(
    async (returnToRoot: boolean) => {
      const path = returnToRoot
        ? `${window.location.origin}/apps/groups/?updatedAt=${Date.now()}`
        : `${window.location.href}?updatedAt=${Date.now()}`;

      if (needRefresh) {
        try {
          await updateServiceWorker(false);
        } catch (e) {
          console.error('Service worker failed to update:', e);
        }
      }

      window.location.assign(path);
    },
    [needRefresh, updateServiceWorker]
  );

  return {
    needsUpdate: needRefresh,
    triggerUpdate,
  };
}

export const AppUpdateContext = createContext<{
  needsUpdate: boolean;
  triggerUpdate: (returnToRoot: boolean) => Promise<void> | null;
}>({ needsUpdate: false, triggerUpdate: () => null });
