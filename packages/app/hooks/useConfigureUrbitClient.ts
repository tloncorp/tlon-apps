import { ClientParams } from '@tloncorp/api';
import { getShipAccessCode } from '@tloncorp/api';
import * as api from '@tloncorp/api';
import { AnalyticsEvent, createDevLogger, sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { configureClient } from '@tloncorp/shared/store';
import { useCallback } from 'react';
import { Alert, Platform, TurboModuleRegistry } from 'react-native';

import { ENABLED_LOGGERS } from '../constants';
import { useShip } from '../contexts/ship';
import { applyRefreshedAuthCookie } from '../utils/authCookie';
import { UrbitModuleSpec } from '../utils/urbitModule';
// We need to import resetDb this way because we have both a resetDb.ts and a
// resetDb.native.ts file. We need to import the right one based on the
// platform.
import { resetDb } from '../lib/resetDb';
import { initializePolyfills } from '../platform/polyfills';
import { useHandleLogout } from './useHandleLogout';

initializePolyfills();

// Only the native platforms keep a cookie copy for their notification service.
const UrbitModule =
  Platform.OS !== 'web'
    ? (TurboModuleRegistry.get('UrbitModule') as UrbitModuleSpec | null)
    : null;

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
  return fetch(input, newInit);
};

// Writes a reauth's cookie over the persisted one. Fire-and-forget: this runs
// from inside the reauth that produced the cookie, and a failure to persist
// only costs us push previews until the next reauth, so it must never reject
// into that caller.
function persistRefreshedAuthCookie(
  shipName: string,
  shipUrl: string,
  authCookie: string
) {
  void (async () => {
    try {
      // The updater form runs inside StorageItem's write lock, so the record it
      // sees cannot be a snapshot taken before a logout or account switch that
      // has since been written. Reading with getValue() first and writing after
      // would let this clobber a resetValue() or the new account's record.
      await db.storage.shipInfo.setValue((stored) =>
        applyRefreshedAuthCookie(stored, { shipName, shipUrl, authCookie })
      );
    } catch (e) {
      clientLogger.trackError('Failed to persist refreshed auth cookie', {
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  })();
}

export function configureUrbitClient({
  ship,
  shipUrl,
  authType,
  onAuthFailure,
}: {
  ship: string;
  shipUrl: string;
  authType: 'self' | 'hosted';
  onAuthFailure?: (params: { mustLogout: boolean }) => void;
}) {
  configureClient({
    shipName: ship,
    shipUrl: shipUrl,
    verbose: ENABLED_LOGGERS.includes('urbit'),
    fetchFn: apiFetch,
    onQuitOrReset: (cause, relevantSubscription) => {
      const discontinuityParams =
        cause === 'subscriptionQuit'
          ? {
              retainChannelStatus: true,
              context: `sub quit: ${relevantSubscription}`,
            }
          : { retainChannelStatus: false };
      sync.handleDiscontinuity(discontinuityParams);
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
    onAuthCookieChange: ({
      shipName: cookieShipName,
      shipUrl: cookieShipUrl,
      authCookie,
    }) => {
      // Reauth reads module-level config after its awaits, so one that started
      // before an account switch can finish after it (TLON-6500). These values
      // come from this function's own arguments, so comparing them against the
      // closure's is exact: a mismatch means the cookie belongs to a client we
      // are no longer configured for, and applying it would point the
      // notification service at the wrong session. The ship is checked as well
      // as the url because a url is not an identity -- the same self-hosted
      // endpoint can end up serving a different ship.
      if (cookieShipName !== ship || cookieShipUrl !== shipUrl) {
        clientLogger.trackEvent(AnalyticsEvent.AuthCookieDropped, {
          context: 'reauth cookie did not match the configured ship',
        });
        return;
      }
      // The stored cookie is what boot replays into native storage, so
      // refreshing native alone would be undone by the next app launch.
      persistRefreshedAuthCookie(cookieShipName, cookieShipUrl, authCookie);
      if (!UrbitModule) {
        return;
      }
      try {
        UrbitModule.setAuthCookie(authCookie);
      } catch (e) {
        // a stale native cookie only degrades push copy, so never let this
        // throw into the reauth that produced it
        clientLogger.trackError('Failed to push auth cookie to native', {
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      }
    },
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
        onAuthFailure: async ({ mustLogout }) => {
          clientLogger.log('Client handling auth failure');
          if (mustLogout) {
            clientLogger.trackEvent(AnalyticsEvent.AuthForcedLogout, {
              authType,
              context: 'Access code invalidated',
            });
            await new Promise<void>((resolve) => {
              Alert.alert(
                'Session Expired',
                'Your access credentials are no longer valid. This can happen after a factory reset. Please log in again.',
                [{ text: 'Logout', onPress: () => resolve() }],
                {
                  cancelable: false,
                }
              );
            });
            await logout();
          } else if (authType === 'self') {
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
