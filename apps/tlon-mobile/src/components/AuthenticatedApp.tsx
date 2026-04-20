import NetInfo from '@react-native-community/netinfo';
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
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import {
  ForwardPostSheetProvider,
  PortalProvider,
  ZStack,
} from '@tloncorp/app/ui';
import * as api from '@tloncorp/api';
import {
  observeSyncSinceCompletion,
  sync,
  syncSince,
  updateSession,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useState } from 'react';

import { checkAnalyticsDigest, useCheckAppUpdated } from '../hooks/analytics';
import { useAutomatedTestDbCommands } from '../hooks/useAutomatedTestDbCommands';
import { useCachedChanges } from '../hooks/useBackgroundData';
import { useCheckNodeStopped } from '../hooks/useCheckNodeStopped';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { usePoorUxShakeReport } from '../hooks/usePoorUxShakeReport';
import { useSyncAppBadge } from '../hooks/useSyncAppBadge';
import { inviteSystemContacts } from '../lib/contactsHelpers';
import { refreshHostingAuth } from '../lib/hostingAuth';
import { AutomatedTestSyncScreen } from '../screens/e2e/AutomatedTestSyncScreen';
import { ShareIntentForwardSheetProvider } from './ShareIntentForwardSheetProvider';

const ABANDONED_FLUSH_TIMEOUT_MS = 300;

function AuthenticatedApp() {
  const telemetry = useTelemetry();
  const checkNodeStopped = useCheckNodeStopped();
  useNotificationListener();
  useUpdatePresentedNotifications();
  useDeepLinkListener();
  useAutomatedTestDbCommands();
  useNetworkLogger();
  useCheckAppUpdated();
  useFindSuggestedContacts();
  useSyncAppBadge();
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
        startChatListSettleMeasurement(status);
        await checkForCachedChanges();
        telemetry.captureAppActive();
        checkNodeStopped();
        refreshHostingAuth();
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
    [checkForCachedChanges, checkNodeStopped, telemetry]
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
    </ZStack>
  );
}

export default function ConnectedAuthenticatedApp() {
  const [clientReady, setClientReady] = useState(false);
  const configureClient = useConfigureUrbitClient();

  useEffect(() => {
    async function setup() {
      configureClient();
      // we store a flag to ensure this runs only once per login, not anytime
      // the app is opened
      const didSyncInitialPosts = await db.didSyncInitialPosts.getValue();
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

      setClientReady(true);
    }
    setup();
  }, [configureClient]);

  // Handle deferred bot group creation from onboarding splash
  useEffect(() => {
    if (!clientReady) return;
    (async () => {
      const pending = await db.pendingBotGroupCreation.getValue();
      if (!pending) return;
      await db.pendingBotGroupCreation.setValue(false);
      try {
        const botConfig = await api.getSettingValue('tlonbotConfig');
        const botName =
          botConfig && typeof botConfig === 'string'
            ? (JSON.parse(botConfig).name ?? 'Tlonbot')
            : 'Tlonbot';
        const group = await store.createDefaultGroup({
          title: `${botName}'s Group`,
        });
        const shipId = await db.hostedUserNodeId.getValue();
        const authCookie = await db.hostingAuthToken.getValue();
        if (shipId && authCookie) {
          await api
            .addBotToCordon(shipId, authCookie, group.id)
            .catch(() => {});
          await api
            .addBotToGroup(shipId, authCookie, group.id)
            .catch(() => {});
        }
      } catch (e) {
        console.warn('Failed to create deferred bot group:', e);
      }
    })();
  }, [clientReady]);

  return (
    <AppDataProvider inviteSystemContacts={inviteSystemContacts}>
      {/* 
        This portal provider overrides the root portal provider 
        to ensure that sheets have access to `AppDataContext`
      */}
      <PortalProvider>
        <ForwardPostSheetProvider>
          <ShareIntentForwardSheetProvider enabled={clientReady}>
            {clientReady && <AuthenticatedApp />}
          </ShareIntentForwardSheetProvider>
        </ForwardPostSheetProvider>
      </PortalProvider>
    </AppDataProvider>
  );
}
