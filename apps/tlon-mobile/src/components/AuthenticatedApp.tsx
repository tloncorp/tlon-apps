import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import NetInfo from '@react-native-community/netinfo';
import { useShip } from '@tloncorp/app/contexts/ship';
import {
  AppStatus,
  useAppStatusChange,
} from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import {
  markChatListMeasurementAbandoned,
  markChatListSyncSinceComplete,
  startChatListSettleMeasurement,
} from '@tloncorp/app/lib/chatListSettleTelemetry';
import { AUTOMATED_TEST } from '@tloncorp/app/lib/envVars';
import { useUpdatePresentedNotifications } from '@tloncorp/app/lib/notifications';
import {
  markPushNotifTapMeasurementAbandoned,
  markPushNotifTapSyncSinceComplete,
} from '@tloncorp/app/lib/pushNotifTapTelemetry';
import { recoverTlonbotRevivalDeferredConfig } from '@tloncorp/app/lib/tlonbotRevivalDeferredConfig';
import { DeskOutdatedScreen } from '@tloncorp/app/features/DeskOutdatedScreen';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import {
  ForwardPostSheetProvider,
  LoadingSpinner,
  ZStack,
  useWebAppSplash,
} from '@tloncorp/app/ui';
import {
  createDevLogger,
  observeSyncSinceCompletion,
  sync,
  syncSince,
  updateSession,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { checkAnalyticsDigest, useCheckAppUpdated } from '../hooks/analytics';
import { useAutomatedTestDbCommands } from '../hooks/useAutomatedTestDbCommands';
import { useCachedChanges } from '../hooks/useBackgroundData';
import { useCheckNodeStopped } from '../hooks/useCheckNodeStopped';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { usePoorUxShakeReport } from '../hooks/usePoorUxShakeReport';
import { useSyncAppBadge } from '../hooks/useSyncAppBadge';
import { useSyncReactionCapability } from '../hooks/useSyncReactionCapability';
import { useRecaptcha } from '../hooks/useRecaptcha';
import { inviteSystemContacts } from '../lib/contactsHelpers';
import {
  clearHostingNativeCookie,
  refreshHostingAuth,
  selectRecaptchaPlatform,
} from '../lib/hostingAuth';
import { HostingAuthReconnectScreen } from '../screens/HostingAuthReconnectScreen';
import { AutomatedTestSyncScreen } from '../screens/e2e/AutomatedTestSyncScreen';
import { ShareIntentForwardSheetProvider } from './ShareIntentForwardSheetProvider';
import { useTlonbotRevivalPrompt } from './TlonbotRevivalPromptSheet';

const ABANDONED_FLUSH_TIMEOUT_MS = 300;
const hostingAuthLogger = createDevLogger('hosting auth guard', true);

// Prefetch posts for the chat list, once per login. Runs after sync start —
// including a sync start that only succeeded on a desk-compatibility retry,
// where the first attempt returned as a gated no-op. The sync size depends on
// the connection, which is why this lives here rather than in shared sync.
async function syncInitialPostsIfNeeded() {
  if (await db.didSyncInitialPosts.getValue()) {
    return;
  }

  const net = await NetInfo.fetch();
  const syncSize =
    net.isConnected &&
    (net.type === 'wifi' ||
      (net.type === 'cellular' &&
        ['4g', '5g'].includes(net.details.cellularGeneration ?? '')))
      ? 'heavy'
      : 'light';
  sync.syncInitialPosts({ syncSize });
}

type RequireHostingAuth = (options?: { force?: boolean }) => Promise<boolean>;

function useRequireHostingAuth(
  onHostingAuthExpired: () => void | Promise<void>
): RequireHostingAuth {
  const { authType } = useShip();
  const expirationReported = useRef(false);
  const checkInFlight = useRef<Promise<boolean> | null>(null);

  return useCallback(
    async (options = {}) => {
      if (checkInFlight.current) {
        return checkInFlight.current;
      }

      const check = (async () => {
        const result = await refreshHostingAuth({
          ...options,
          authType,
        }).catch((error) => {
          hostingAuthLogger.trackError('Failed to check hosting auth', {
            error,
          });
          return 'unknown' as const;
        });
        if (result !== 'expired') {
          expirationReported.current = false;
          return true;
        }

        if (!expirationReported.current) {
          expirationReported.current = true;
          hostingAuthLogger.trackEvent('Hosting Reconnect Required', {
            authType,
          });
          await onHostingAuthExpired();
        }
        return false;
      })();

      checkInFlight.current = check;
      try {
        return await check;
      } finally {
        if (checkInFlight.current === check) {
          checkInFlight.current = null;
        }
      }
    },
    [authType, onHostingAuthExpired]
  );
}

function AuthenticatedApp({
  onLogout,
  requireHostingAuth,
}: {
  onLogout: () => void | Promise<void>;
  requireHostingAuth: RequireHostingAuth;
}) {
  const telemetry = useTelemetry();
  const deskCompat = store.useDeskCompatibility();
  const { contactId } = useShip();
  const checkNodeStopped = useCheckNodeStopped();
  const { maybeShowPrompt, promptSheet } = useTlonbotRevivalPrompt();
  const { splashSheet: webAppSplashSheet } = useWebAppSplash();
  useNotificationListener();
  useUpdatePresentedNotifications();
  useDeepLinkListener();
  useAutomatedTestDbCommands();
  useNetworkLogger();
  useCheckAppUpdated();
  useFindSuggestedContacts();
  useSyncAppBadge();
  useSyncReactionCapability();
  const checkForCachedChanges = useCachedChanges();
  const { poorUxReportModal } = usePoorUxShakeReport();

  const handleAppStatusChange = useCallback(
    async (status: AppStatus) => {
      let gated = false;
      if (status === 'inactive' || status === 'background') {
        const didAbandonChatList = markChatListMeasurementAbandoned(status);
        const didAbandonPushNotif =
          markPushNotifTapMeasurementAbandoned(status);
        const didAbandon = didAbandonChatList || didAbandonPushNotif;
        if (didAbandon) {
          // we want to make sure the flush call gets time to execute, but
          // avoid blocking if it hangs
          await Promise.race([
            telemetry.flush(),
            new Promise<void>((resolve) =>
              setTimeout(resolve, ABANDONED_FLUSH_TIMEOUT_MS)
            ),
          ]).catch(() => {});
        }
        return;
      }

      // app opened or returned from background
      if (status === 'opened' || status === 'active') {
        if (!(await requireHostingAuth())) {
          return;
        }

        // Read live rather than from render state, so a gate that arrives
        // mid-session is respected. Everything that would talk to the desk is
        // skipped while it's up — including on 'opened', which fires as soon as
        // the notice mounts. Node status still has to be checked: a paused or
        // suspended host has to kick back to onboarding from here.
        gated = store.isDeskGated(store.getSession()?.deskCompat);

        startChatListSettleMeasurement(status);
        if (!gated) {
          // Furnishes a group and pushes profile/bot config to the host.
          recoverTlonbotRevivalDeferredConfig(status).catch(() => {});
        }
        // Local only: reads the native background cache into the db.
        await checkForCachedChanges();
        telemetry.captureAppActive();
        const nodeCheck = await checkNodeStopped();
        await maybeShowPrompt(nodeCheck);
        checkAnalyticsDigest();
      }

      // app returned from background
      if (status === 'active') {
        if (gated) {
          // syncSince would fail the same way startup did.
          return;
        }
        updateSession({ isSyncing: true });
        syncSince({ callCtx: { cause: 'app-foregrounded' } })
          .catch(() => {})
          .then(() => {
            sync.syncPinnedItems({ priority: sync.SyncPriority.High });
          });
      }
    },
    [
      checkForCachedChanges,
      checkNodeStopped,
      maybeShowPrompt,
      requireHostingAuth,
      telemetry,
    ]
  );

  useAppStatusChange(handleAppStatusChange);

  // track sync completion for telemetry
  useEffect(() => {
    return observeSyncSinceCompletion((event) => {
      if (event.cause === 'sync-start' || event.cause === 'app-foregrounded') {
        markChatListSyncSinceComplete(
          event.result,
          event.durationMs,
          event.hadChanges,
          event.nodeBusyStatus,
          event.postsCount,
          event.neededToSyncLatestPosts,
          event.unreadTargets
        );
        markPushNotifTapSyncSinceComplete(
          event.result,
          event.durationMs,
          event.nodeBusyStatus,
          event.postsCount,
          event.neededToSyncLatestPosts
        );
      }
    });
  }, []);

  useEffect(() => {
    // reset this anytime we get back into the authenticated app
    db.nodeStoppedWhileLoggedIn.setValue(false);
  }, []);

  // The desk gate skips the desk-dependent half of the 'opened' callback, and
  // clearing it — by Try again or by an automatic recovery — raises no
  // app-status event of its own, so deferred config would sit unapplied until
  // the next foreground.
  const wasDeskGated = useRef(false);
  useEffect(() => {
    if (store.isDeskGated(deskCompat)) {
      wasDeskGated.current = true;
      return;
    }
    if (deskCompat?.status === 'ok' && wasDeskGated.current) {
      wasDeskGated.current = false;
      recoverTlonbotRevivalDeferredConfig('desk_gate_cleared').catch(() => {});
    }
  }, [deskCompat]);

  const handleRetryDeskCompatibility = useCallback(() => {
    sync
      .retryDeskCompatibility({ onRecovered: syncInitialPostsIfNeeded })
      .catch(() => {});
  }, []);

  return (
    <ZStack flex={1}>
      {store.shouldShowDeskNotice(deskCompat) ? (
        // In place of the navigator rather than around it, so the node-stopped
        // and app-status handling above stays mounted: a paused or suspended
        // hosted node still kicks back to onboarding while this is up.
        <DeskOutdatedScreen
          currentVersion={deskCompat.current}
          minimumVersion={deskCompat.minimum}
          shipName={contactId ?? undefined}
          isProbing={deskCompat.status === 'probing'}
          onRetry={handleRetryDeskCompatibility}
          onLogout={onLogout}
        />
      ) : (
        <RootStack />
      )}
      {AUTOMATED_TEST && <AutomatedTestSyncScreen />}
      {/* Shake-triggered, so it can't cover the notice on its own; someone who
          shakes the phone at a broken-looking screen wants the bug reporter. */}
      {poorUxReportModal}
      {/* Both open themselves — the revival prompt from the app-status
          callback, the web-app splash from its own mount effect — so they'd
          cover the notice, and the prompt leads into an onboarding flow this
          desk can't serve. Same gate as the onboarding overlay below. */}
      {deskCompat?.status === 'ok' ? promptSheet : null}
      {deskCompat?.status === 'ok' ? webAppSplashSheet : null}
    </ZStack>
  );
}

function AuthenticatedAppContent({
  onLogout,
  requireHostingAuth,
}: {
  onLogout: () => void | Promise<void>;
  requireHostingAuth: RequireHostingAuth;
}) {
  const [clientReady, setClientReady] = useState(false);
  const configureClient = useConfigureUrbitClient();
  const deskCompat = store.useDeskCompatibility();
  // Hold the spinner until the cold-start probe reports, rather than flashing
  // the app on ahead of the notice. Bounded by the probe's own timeout.
  const isProbingColdStart = store.isDeskProbePending(deskCompat);

  useEffect(() => {
    let canceled = false;

    configureClient();
    // syncInitialPostsIfNeeded checks the once-per-login flag itself; reading
    // it here holds the spinner until storage is readable.
    db.didSyncInitialPosts.getValue().then(() => {
      sync
        .syncStart()
        .then(syncInitialPostsIfNeeded)
        .catch(() => {});

      if (!canceled) {
        setClientReady(true);
      }
    });

    return () => {
      canceled = true;
    };
  }, [configureClient]);

  if (!clientReady || isProbingColdStart) {
    return (
      <ZStack flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </ZStack>
    );
  }

  return (
    <AppDataProvider inviteSystemContacts={inviteSystemContacts}>
      {/*
        Re-root BottomSheetModalProvider here so @gorhom/bottom-sheet modal
        sheets have access to `AppDataContext`. Tamagui sheets don't need a
        re-rooted PortalProvider: native portals (react-native-teleport) keep
        the React tree in place, so portaled content already sees this context.
      */}
      <BottomSheetModalProvider>
        <ForwardPostSheetProvider>
          <ShareIntentForwardSheetProvider enabled>
            <AuthenticatedApp
              onLogout={onLogout}
              requireHostingAuth={requireHostingAuth}
            />
          </ShareIntentForwardSheetProvider>
        </ForwardPostSheetProvider>
      </BottomSheetModalProvider>
    </AppDataProvider>
  );
}

export default function ConnectedAuthenticatedApp({
  onLogout,
  authenticatedContent,
  authenticatedOverlay,
}: {
  onLogout: () => void | Promise<void>;
  authenticatedContent?: ReactNode;
  authenticatedOverlay?: ReactNode;
}) {
  const [hostingAuthState, setHostingAuthState] = useState<
    'checking' | 'valid' | 'expired'
  >('checking');
  const [authAttempt, setAuthAttempt] = useState(0);
  const [profile, setProfile] = useState<db.Contact | null>(null);
  const { contactId } = useShip();
  const deskCompat = store.useDeskCompatibility();
  const { getToken: getRecaptchaToken } = useRecaptcha(
    hostingAuthState === 'expired'
  );
  const handleHostingAuthExpired = useCallback(() => {
    setHostingAuthState('expired');
  }, []);
  const requireHostingAuth = useRequireHostingAuth(handleHostingAuthExpired);

  const handleGateAppStatusChange = useCallback(
    async (status: AppStatus) => {
      if (status === 'opened') {
        await requireHostingAuth({ force: true });
      } else if (status === 'active') {
        await requireHostingAuth();
      }
    },
    [requireHostingAuth]
  );
  useAppStatusChange(handleGateAppStatusChange);

  useEffect(() => {
    let canceled = false;
    if (!contactId) {
      return;
    }

    db.getContact({ id: contactId })
      .then((contact) => {
        if (!canceled) {
          setProfile(contact);
        }
      })
      .catch((error) => {
        hostingAuthLogger.trackError(
          'Failed to load profile for Hosting reconnect',
          { error }
        );
      });

    return () => {
      canceled = true;
    };
  }, [contactId]);

  const requestReconnectCode = useCallback(async () => {
    const recaptchaToken = await getRecaptchaToken('request_otp');
    return store.requestHostingAuthReconnectCode({
      recaptchaToken,
      platform: selectRecaptchaPlatform(),
    });
  }, [getRecaptchaToken]);

  const verifyReconnectCode = useCallback(async (otp: string) => {
    await store.confirmHostingAuthReconnectCode(otp);
    await clearHostingNativeCookie();
    hostingAuthLogger.trackEvent('Hosting Reconnect Succeeded');
    setHostingAuthState('checking');
    setAuthAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let canceled = false;

    async function setup() {
      hostingAuthLogger.log('Starting authenticated app', { authAttempt });
      if (!(await requireHostingAuth({ force: true })) || canceled) {
        return;
      }

      setHostingAuthState('valid');
    }
    setup();

    return () => {
      canceled = true;
    };
  }, [authAttempt, requireHostingAuth]);

  if (hostingAuthState === 'expired') {
    return (
      <HostingAuthReconnectScreen
        profileId={contactId ?? ''}
        profile={profile}
        onRequestCode={requestReconnectCode}
        onVerifyCode={verifyReconnectCode}
        onLogout={onLogout}
      />
    );
  }

  if (hostingAuthState === 'checking') {
    return (
      <ZStack flex={1} alignItems="center" justifyContent="center">
        <LoadingSpinner />
      </ZStack>
    );
  }

  if (authenticatedContent !== undefined) {
    return authenticatedContent;
  }

  return (
    <ZStack flex={1}>
      <AuthenticatedAppContent
        onLogout={onLogout}
        requireHostingAuth={requireHostingAuth}
      />
      {/* Only once the desk is known good. The overlay is opaque and
          full-screen, so it would bury the notice — and the spinner that
          precedes it — and its onboarding sequence starts furnishing a group
          straight away, which an incompatible desk can't serve. */}
      {deskCompat?.status === 'ok' ? authenticatedOverlay : null}
    </ZStack>
  );
}
