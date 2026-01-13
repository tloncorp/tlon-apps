import NetInfo from '@react-native-community/netinfo';
import {
  AppStatus,
  useAppStatusChange,
} from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import { useUpdatePresentedNotifications } from '@tloncorp/app/lib/notifications';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import {
  ForwardPostSheetProvider,
  PortalProvider,
  ZStack,
} from '@tloncorp/app/ui';
import { sync, syncSince, updateSession } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';

import { checkAnalyticsDigest, useCheckAppUpdated } from '../hooks/analytics';
import { useCachedChanges } from '../hooks/useBackgroundData';
import { useCheckNodeStopped } from '../hooks/useCheckNodeStopped';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { useSyncAppBadge } from '../hooks/useSyncAppBadge';
import { inviteSystemContacts } from '../lib/contactsHelpers';
import { refreshHostingAuth } from '../lib/hostingAuth';

function AuthenticatedApp() {
  const telemetry = useTelemetry();
  const checkNodeStopped = useCheckNodeStopped();
  useNotificationListener();
  useUpdatePresentedNotifications();
  useDeepLinkListener();
  useNetworkLogger();
  useCheckAppUpdated();
  useFindSuggestedContacts();
  useSyncAppBadge();
  const checkForCachedChanges = useCachedChanges();

  const handleAppStatusChange = useCallback(
    async (status: AppStatus) => {
      // app opened or returned from background
      if (status === 'opened' || status === 'active') {
        await checkForCachedChanges();
        telemetry.captureAppActive();
        checkNodeStopped();
        refreshHostingAuth();
        checkAnalyticsDigest();
      }

      // app returned from background
      if (status === 'active') {
        updateSession({ isSyncing: true });
        syncSince({ callCtx: { cause: 'app-foregrounded' } });
        setTimeout(() => {
          sync.syncPinnedItems({ priority: sync.SyncPriority.High });
        }, 100);
      }
    },
    [checkForCachedChanges, checkNodeStopped, telemetry]
  );

  useAppStatusChange(handleAppStatusChange);

  useEffect(() => {
    // reset this anytime we get back into the authenticated app
    db.nodeStoppedWhileLoggedIn.setValue(false);
  }, []);

  return (
    <ZStack flex={1}>
      <RootStack />
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
      sync.syncStart().then(async () => {
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
      });

      setClientReady(true);
    }
    setup();
  }, [configureClient]);

  return (
    <AppDataProvider inviteSystemContacts={inviteSystemContacts}>
      {/* 
        This portal provider overrides the root portal provider 
        to ensure that sheets have access to `AppDataContext`
      */}
      <PortalProvider>
        <ForwardPostSheetProvider>
          {clientReady && <AuthenticatedApp />}
        </ForwardPostSheetProvider>
      </PortalProvider>
    </AppDataProvider>
  );
}
