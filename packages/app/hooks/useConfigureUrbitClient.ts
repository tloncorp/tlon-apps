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

// Refreshes the copies of the auth cookie that live outside the client: the
// persisted ShipInfo record, and on native the one the notification service
// reads. Fire-and-forget -- this runs from inside the reauth that produced the
// cookie, and failing to refresh only costs push previews until the next
// reauth, so it must never reject into that caller.
//
// Each copy is arbitrated by whoever owns it, because this runs across awaits
// and the active account can change at any of them. internalRemoveClient
// leaves a pending reauth and its callback installed, and logout and account
// switch write ship info before the client is reconfigured (setShip in
// ShipLoginScreen vs configureClient in ConnectedAuthenticatedApp), so neither
// this closure nor any flag computed earlier is trustworthy by the time a
// write lands:
//
//   - the persisted record is decided inside StorageItem's write lock, by the
//     updater, against the record as of that write
//   - the native copy is decided by UrbitModule.setAuthCookie, which compares
//     against the ship and url it currently holds; that is the only place the
//     check and the write are not separated by an await
//
// The two are therefore independent, and deliberately not sequenced: native
// keeps its own ship and url (setUrbit writes all three together), so it can
// hold the active account even when the persisted write fails. Gating it on
// that write would skip it there -- and skip it for the rest of the session,
// since a rejected StorageItem write leaves `updateLock` rejected and every
// later setValue on that item inherits the rejection.
function refreshAuthCookieCopies(
  shipName: string,
  shipUrl: string,
  authCookie: string
) {
  try {
    // Synchronous and unconditional: nothing this function does afterwards can
    // starve it, and native decides for itself whether to accept.
    UrbitModule?.setAuthCookie(shipName, shipUrl, authCookie);
  } catch (e) {
    // an older native binary under a newer JS bundle may not have the method
    clientLogger.trackError('Failed to refresh the native auth cookie', {
      errorMessage: e instanceof Error ? e.message : String(e),
    });
  }

  void (async () => {
    try {
      let applied = false;
      // The updater form runs inside StorageItem's write lock, so the record it
      // sees cannot be a snapshot taken before a logout or account switch that
      // has since been written. Reading with getValue() first and writing after
      // would let this clobber a resetValue() or the new account's record.
      await db.storage.shipInfo.setValue((stored) => {
        const next = applyRefreshedAuthCookie(stored, {
          shipName,
          shipUrl,
          authCookie,
        });
        // the helper hands back `stored` itself when it declines
        applied = next !== stored;
        return next;
      });
      if (!applied) {
        clientLogger.trackEvent(AnalyticsEvent.AuthCookieDropped, {
          context: 'stored ship info belongs to a different session',
        });
      }
    } catch (e) {
      clientLogger.trackError('Failed to persist the refreshed auth cookie', {
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
      //
      // This is a cheap early-out, not the real arbiter: the closure is only
      // as current as the last configureClient. refreshAuthCookieCopies
      // decides from the persisted record, which a logout or account switch
      // updates first.
      if (cookieShipName !== ship || cookieShipUrl !== shipUrl) {
        clientLogger.trackEvent(AnalyticsEvent.AuthCookieDropped, {
          context: 'reauth cookie did not match the configured ship',
        });
        return;
      }
      refreshAuthCookieCopies(cookieShipName, cookieShipUrl, authCookie);
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
