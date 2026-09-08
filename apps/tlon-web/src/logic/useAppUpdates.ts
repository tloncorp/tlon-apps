import { createDevLogger, queryClient } from '@tloncorp/shared';
import { createContext, useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import useKilnState, { usePike } from '@/state/kiln';

const logger = createDevLogger('appUpdates', false);

// The context is part of the title because Sentry fingerprints on
// ['app_error', logger, errorTitle], so the two pollers stay separate issues
// rather than merging into one pile.
function reportCheckFailed(context: 'serviceWorker' | 'pikes', e: unknown) {
  logger.trackError(
    `app update check failed: ${context}`,
    e instanceof Error ? { error: e } : { errorMessage: String(e) }
  );
}

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

        if ('onLine' in navigator && !navigator.onLine) {
          return;
        }

        // A failed update check is expected and harmless — the ship may be
        // asleep or briefly unreachable, and the next tick retries. Swallow it
        // so it doesn't escape this async callback as an unhandled rejection
        // and get reported to Sentry.
        try {
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
        } catch (e) {
          reportCheckFailed('serviceWorker', e);
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
      // Same rationale as the service-worker poll above: the scry fails
      // whenever the ship is unreachable, and this floating promise would
      // otherwise reject as an unhandled error.
      useKilnState
        .getState()
        .fetchPikes()
        .catch((e) => reportCheckFailed('pikes', e));
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
        const timeout = setTimeout(() => setNeedsUpdate(true), 5 * 60 * 1000);
        return () => clearTimeout(timeout);
      }
    }
  }, [pike, initialHash, needsUpdate]);

  const triggerUpdate = useCallback(
    async (returnToRoot: boolean) => {
      const basePath = '/apps/groups/';
      const path = returnToRoot
        ? `${window.location.origin}${basePath}?updatedAt=${Date.now()}`
        : `${window.location.href}?updatedAt=${Date.now()}`;

      if (needRefresh) {
        queryClient.clear();
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
