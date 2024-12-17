import { createDevLogger, sync } from '@tloncorp/shared';
import { ClientParams } from '@tloncorp/shared/api';
import { configureClient } from '@tloncorp/shared/store';
import { EventStreamContentType } from 'packages/shared/src/http-api/fetch-event-source';
import { useCallback } from 'react';

import { ENABLED_LOGGERS } from '../constants';
import { useShip } from '../contexts/ship';
import { getShipAccessCode } from '../lib/hostingApi';
// We need to import resetDb this way because we have both a resetDb.ts and a
// resetDb.native.ts file. We need to import the right one based on the
// platform.
import { resetDb } from '../lib/resetDb';
import { initializePolyfills, platformFetch } from '../platform/polyfills';
import { useHandleLogout } from './useHandleLogout';

initializePolyfills();

let abortController = new AbortController();

const clientLogger = createDevLogger('configure client', true);

const apiFetch: typeof fetch = (input, { ...init } = {}) => {
  // Wire our injected AbortController up to the one passed in by the client.
  if (init.signal) {
    init.signal.onabort = () => {
      abortController.abort();
      abortController = new AbortController();
    };
  }

  const headers: any = { ...init.headers };
  console.log(`bl: resolved headers`, headers);
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
    signal: abortController.signal,
  };
  const containsEventStream = headers['accept'] === EventStreamContentType;
  console.log(`new init 2`, newInit, containsEventStream);
  return containsEventStream
    ? platformFetch(input, newInit)
    : fetch(input, newInit);
};

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
        fetchFn: apiFetch,
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
