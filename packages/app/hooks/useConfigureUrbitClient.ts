import { sync, useCurrentSession } from '@tloncorp/shared/dist';
import { ClientParams } from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { ENABLED_LOGGERS } from '../constants';
import { configureClient } from '../lib/api';

type PickPartial<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;

export function useConfigureUrbitClient() {
  const session = useCurrentSession();

  return useCallback(
    (params: PickPartial<ClientParams, 'shipName' | 'shipUrl'>) => {
      configureClient({
        verbose: ENABLED_LOGGERS.includes('urbit'),
        onReconnect: () => sync.handleDiscontinuity(),
        onChannelReset: () => {
          const threshold = __DEV__ ? 60 * 1000 : 12 * 60 * 60 * 1000; // 12 hours
          const lastReconnect = session?.startTime ?? 0;
          if (Date.now() - lastReconnect >= threshold) {
            sync.handleDiscontinuity();
          }
        },
        onChannelStatusChange: sync.handleChannelStatusChange,
        // override any defaults with params
        ...params,
      });
    },
    [session]
  );
}
