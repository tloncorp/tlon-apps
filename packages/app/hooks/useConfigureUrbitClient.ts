import {
  createDevLogger,
  getSession,
  sync,
  updateSession,
} from '@tloncorp/shared/dist';
import { ClientParams } from '@tloncorp/shared/dist/api';
import { configureClient } from '@tloncorp/shared/dist/store';
import { useCallback } from 'react';
//@ts-expect-error no typedefs
import { fetch as streamingFetch } from 'react-native-fetch-api';
//@ts-expect-error no typedefs
import { polyfill as polyfillEncoding } from 'react-native-polyfill-globals/src/encoding';
//@ts-expect-error no typedefs
import { polyfill as polyfillReadableStream } from 'react-native-polyfill-globals/src/readable-stream';

import { ENABLED_LOGGERS } from '../constants';
import { useShip } from '../contexts/ship';
import { getShipAccessCode } from '../lib/hostingApi';
import { resetDb } from '../lib/nativeDb';
import { useHandleLogout } from './useHandleLogout';

polyfillReadableStream();
polyfillEncoding();

let abortController = new AbortController();

const apiFetch: typeof fetch = (input, { ...init } = {}) => {
  // Wire our injected AbortController up to the one passed in by the client.
  if (init.signal) {
    init.signal.onabort = () => {
      abortController.abort();
      abortController = new AbortController();
    };
  }

  const headers = new Headers(init.headers);
  // The urbit client is inconsistent about sending cookies, sometimes causing
  // the server to send back a new, anonymous, cookie, which is sent on all
  // subsequent requests and screws everything up. This ensures that explicit
  // cookie headers are never set, delegating all cookie handling to the
  // native http client.
  headers.delete('Cookie');
  headers.delete('cookie');
  const newInit: RequestInit = {
    ...init,
    headers,
    // Avoid setting credentials method for same reason as above.
    credentials: undefined,
    signal: abortController.signal,
    // @ts-expect-error This is used by the SSE polyfill to determine whether
    // to stream the request.
    reactNative: { textStreaming: true },
  };
  return streamingFetch(input, newInit);
};

export const cancelFetch = () => {
  abortController.abort();
  abortController = new AbortController();
};

const clientLogger = createDevLogger('configure client', false);

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
        cancelFetch,
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
