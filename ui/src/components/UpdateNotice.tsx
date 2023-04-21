import React, { useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import AsteriskIcon from '@/components/icons/Asterisk16Icon';
import { isTalk } from '@/logic/utils';

const updateInterval =
  import.meta.env.MODE === 'sw' ? 10 * 1000 : 5 * 60 * 1000;

export default function UpdateNotice() {
  const appName = isTalk ? 'Talk' : 'Groups';
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
      }, updateInterval);
    },
  });

  const onClick = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="z-50 flex items-center justify-between bg-yellow py-1 px-2 text-sm font-medium text-black dark:text-white">
      <div className="flex items-center">
        <AsteriskIcon className="mr-3 h-4 w-4" />
        <span className="mr-1">
          {appName} has updated in the background. Please click update to load
          the latest version.
        </span>
      </div>
      <button className="py-1 px-2" onClick={onClick}>
        Update
      </button>
    </div>
  );
}
