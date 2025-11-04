import { AnalyticsEvent, createDevLogger, sync } from '@tloncorp/shared';
import { ClientParams } from '@tloncorp/shared/api';
import { getShipAccessCode } from '@tloncorp/shared/api';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import { configureClient } from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { ENABLED_LOGGERS } from '../constants';
import { useShip } from '../contexts/ship';
// We need to import resetDb this way because we have both a resetDb.ts and a
// resetDb.native.ts file. We need to import the right one based on the
// platform.
import { resetDb } from '../lib/resetDb';
import { initializePolyfills, platformFetch } from '../platform/polyfills';
import { useHandleLogout } from './useHandleLogout';

initializePolyfills();

const clientLogger = createDevLogger('configure client', true);

const apiFetch: typeof fetch = (input, { ...init } = {}) => {
  const headers: any = { ...init.headers };
  // The urbit client is inconsistent about sending cookies, sometimes causing
  // the server to send back a new, anonymous, cookie, which is sent on all
  // subsequent requests and screws everything up. This ensures that explicit
  // cookie headers are never set, delegating all cookie handling to the
  // native http client.
  delete headers['Cookie'];
  delete headers['cookie'];
  const newInit: RequestInit = {
    ...init,
    headers,
    // Avoid setting credentials method for same reason as above.
    credentials: undefined,
  };
  const containsEventStream = headers['accept'] === 'text/event-stream';
  return containsEventStream
    ? platformFetch(input, newInit)
    : fetch(input, newInit);
};

export function configureUrbitClient({
  ship,
  shipUrl,
  authType,
  onAuthFailure,
}: {
  ship: string;
  shipUrl: string;
  authType: 'self' | 'hosted';
  onAuthFailure?: () => void;
}) {
  configureClient({
    shipName: ship,
    shipUrl: shipUrl,
    verbose: ENABLED_LOGGERS.includes('urbit'),
    fetchFn: apiFetch,
    onQuitOrReset: (cause) => {
      sync.handleDiscontinuity({
        retainChannelStatus: cause === 'subscriptionQuit',
      });
    },
    onChannelStatusChange: sync.handleChannelStatusChange,
    getCode: async () => {
      clientLogger.log('Client getting access code');
      // use stored access code to reauth if we have it
      const accessCode = await db.nodeAccessCode.getValue();
      if (accessCode) {
        clientLogger.trackEvent('Recovered Auth Code from Storage');
        return accessCode;
      }

      // if missing and they're hosted, try to fetch it
      if (authType === 'self') {
        const message = 'Self hosted user has no stored access code';
        clientLogger.trackEvent(AnalyticsEvent.AuthFailedToGetCode, {
          authType,
          context: message,
        });
        throw new Error(message);
      }

      if (!ship) {
        const message = 'Cannot get access code, no ship set';
        clientLogger.trackEvent(AnalyticsEvent.AuthFailedToGetCode, {
          authType,
          context: message,
        });
        throw new Error(message);
      }
      const { code } = await getShipAccessCode(ship);
      if (!code) {
        const message = 'Failed to fetch access code';
        clientLogger.trackEvent(AnalyticsEvent.AuthFailedToGetCode, {
          authType,
          context: message,
        });
        throw new Error(message);
      } else {
        clientLogger.trackEvent('Recovered Auth Code from Hosting');
      }
      return code;
    },
    handleAuthFailure: onAuthFailure,
  });
}

export function useConfigureUrbitClient() {
  const shipInfo = useShip();
  const { ship, shipUrl, authType } = shipInfo;
  const runResetDb = useCallback(() => {
    resetDb();
  }, []);
  const logout = useHandleLogout({
    resetDb: runResetDb,
  });

  return useCallback(
    (params?: Partial<ClientParams>) => {
      configureUrbitClient({
        ship: params?.shipName ?? ship ?? '',
        shipUrl: params?.shipUrl ?? shipUrl ?? '',
        authType,
        onAuthFailure: async () => {
          clientLogger.log('Client handling auth failure');
          if (authType === 'self') {
            // there's nothing we can do to recover, must log out
            clientLogger.trackEvent(AnalyticsEvent.AuthForcedLogout, {
              authType,
            });
            await logout();
          } else {
            // we can recover if hosting auth is still valid, only logout if we
            // know for sure it's expired. Notably, this will never trigger if you're
            // offline.
            const hostingAuthStatus = await api.getHostingHeartBeat();
            if (hostingAuthStatus === 'expired') {
              clientLogger.trackEvent(AnalyticsEvent.AuthForcedLogout, {
                authType,
                context: 'Hosting auth was expired',
              });
              await logout();
            }
          }
        },
      });
    },
    [authType, logout, ship, shipUrl]
  );
}
