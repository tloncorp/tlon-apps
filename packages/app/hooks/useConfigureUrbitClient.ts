import {
  createDevLogger,
  getSession,
  sync,
  updateSession,
} from '@tloncorp/shared/dist';
import { useCallback } from 'react';

import { ENABLED_LOGGERS } from '../constants';
import { useShip } from '../contexts/ship';
import { configureClient } from '../lib/api';
import { getShipAccessCode } from '../lib/hostingApi';
import { resetDb } from '../lib/nativeDb';
import { useHandleLogout } from './useHandleLogout';

const appLogger = createDevLogger('configure client', false);

export function useConfigureUrbitClient() {
  const shipInfo = useShip();
  const { ship, shipUrl, authType } = shipInfo;
  const logout = useHandleLogout({
    resetDb: () => {
      appLogger.log('Resetting db on logout');
      resetDb();
    },
  });

  return useCallback(() => {
    configureClient({
      shipName: ship ?? '',
      shipUrl: shipUrl ?? '',
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
      getCode:
        authType === 'self'
          ? undefined
          : async () => {
              appLogger.log('Getting ship access code', {
                ship,
                authType,
              });
              appLogger.trackError(
                'Hosted ship logged out of urbit, getting ship access code'
              );
              if (!ship) {
                throw new Error('Trying to retrieve +code, no ship set');
              }

              const { code } = await getShipAccessCode(ship);
              return code;
            },
      handleAuthFailure: async () => {
        appLogger.trackError(
          'Failed to authenticate with ship, redirecting to login'
        );
        await logout();
        // TODO: route them to hosted sign in vs log in?
      },
    });
  }, [authType, logout, ship, shipUrl]);
}
