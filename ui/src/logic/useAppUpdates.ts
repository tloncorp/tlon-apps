import { createContext, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

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
