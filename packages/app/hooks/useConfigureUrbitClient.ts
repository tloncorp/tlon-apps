import { createDevLogger, sync } from '@tloncorp/shared/dist';
import { ClientParams } from '@tloncorp/shared/dist/api';
import { configureClient } from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';

import { ENABLED_LOGGERS } from '../constants';
import { useShip } from '../contexts/ship';
import { getShipAccessCode } from '../lib/hostingApi';
import { resetDb } from '../lib/nativeDb';
import { useHandleLogout } from './useHandleLogout';

const clientLogger = createDevLogger('configure client', true);

export function useConfigureUrbitClient() {
  const shipInfo = useShip();
  const { ship, shipUrl, authType } = shipInfo;
  const logout = useHandleLogout({
    resetDb: () => {
      clientLogger.log('Resetting db on logout');
      resetDb();
    },
  });

  return useCallback(
    (params?: Partial<ClientParams>) => {
      configureClient({
        shipName: params?.shipName ?? ship ?? '',
        shipUrl: params?.shipUrl ?? shipUrl ?? '',
        verbose: ENABLED_LOGGERS.includes('urbit'),
        onQuitOrReset: sync.handleDiscontinuity,
        onChannelStatusChange: sync.handleChannelStatusChange,
        getCode:
          authType === 'self'
            ? undefined
            : async () => {
                clientLogger.log('Getting ship access code', {
                  ship,
                  authType,
                });
                clientLogger.trackError(
                  'Hosted ship logged out of urbit, getting ship access code'
                );
                if (!ship) {
                  throw new Error('Trying to retrieve +code, no ship set');
                }

                const { code } = await getShipAccessCode(ship);
                return code;
              },
        handleAuthFailure: async () => {
          clientLogger.error(
            'Failed to authenticate with ship, redirecting to login'
          );
          clientLogger.trackError(
            'Failed to authenticate with ship, redirecting to login'
          );
          await logout();
          // TODO: route them to hosted sign in vs log in?
        },
      });
    },
    [authType, logout, ship, shipUrl]
  );
}
