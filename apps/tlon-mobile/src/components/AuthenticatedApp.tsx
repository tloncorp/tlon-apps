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
  requireHostingAuth,
}: {
  requireHostingAuth: RequireHostingAuth;
}) {
  const telemetry = useTelemetry();
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
        startChatListSettleMeasurement(status);
        recoverTlonbotRevivalDeferredConfig(status).catch(() => {});
        await checkForCachedChanges();
        telemetry.captureAppActive();
        const nodeCheck = await checkNodeStopped();
        await maybeShowPrompt(nodeCheck);
        checkAnalyticsDigest();
      }

      // app returned from background
      if (status === 'active') {
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

  return (
    <ZStack flex={1}>
      <RootStack />
      {AUTOMATED_TEST && <AutomatedTestSyncScreen />}
      {poorUxReportModal}
      {promptSheet}
      {webAppSplashSheet}
    </ZStack>
  );
}

function AuthenticatedAppContent({
  requireHostingAuth,
}: {
  requireHostingAuth: RequireHostingAuth;
}) {
  const [clientReady, setClientReady] = useState(false);
  const configureClient = useConfigureUrbitClient();

  useEffect(() => {
    let canceled = false;

    configureClient();
    // we store a flag to ensure this runs only once per login, not anytime
    // the app is opened
    db.didSyncInitialPosts.getValue().then((didSyncInitialPosts) => {
      sync
        .syncStart()
        .then(async () => {
          if (!didSyncInitialPosts) {
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
        })
        .catch(() => {});

      if (!canceled) {
        setClientReady(true);
      }
    });

    return () => {
      canceled = true;
    };
  }, [configureClient]);

  if (!clientReady) {
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
            <AuthenticatedApp requireHostingAuth={requireHostingAuth} />
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
      <AuthenticatedAppContent requireHostingAuth={requireHostingAuth} />
      {authenticatedOverlay}
    </ZStack>
  );
}
