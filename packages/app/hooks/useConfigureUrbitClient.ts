import { getSession, sync, updateSession } from '@tloncorp/shared/dist';
import { ClientParams } from '@tloncorp/shared/dist/api';
import { useCallback } from 'react';

import { ENABLED_LOGGERS } from '../constants';
import { configureClient } from '../lib/api';

type PickPartial<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;

export function useConfigureUrbitClient() {
  return useCallback(
    (params: PickPartial<ClientParams, 'shipName' | 'shipUrl'>) => {
      configureClient({
        verbose: ENABLED_LOGGERS.includes('urbit'),
        onReconnect: () => {
          const threshold = 5 * 60 * 1000; // 5 minutes
          const lastReconnect = getSession()?.startTime ?? 0;
          if (Date.now() - lastReconnect >= threshold) {
            sync.handleDiscontinuity();
          } else {
            updateSession({ startTime: Date.now() });
          }
        },
        onChannelReset: () => {
          const threshold = __DEV__ ? 60 * 1000 : 12 * 60 * 60 * 1000; // 12 hours
          const lastReconnect = getSession()?.startTime ?? 0;
          if (Date.now() - lastReconnect >= threshold) {
            sync.handleDiscontinuity();
          }
        },
        onChannelStatusChange: sync.handleChannelStatusChange,
        // override any defaults with params
        ...params,
      });
    },
    []
  );
}
