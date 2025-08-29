import {
  AppStatus,
  useAppStatusChange,
} from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import { useUpdatePresentedNotifications } from '@tloncorp/app/lib/notifications';
import { hapticPerfSignal } from '@tloncorp/app/lib/platformHelpers';
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
import { useCheckNodeStopped } from '../hooks/useCheckNodeStopped';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
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

  const handleAppStatusChange = useCallback(
    (status: AppStatus) => {
      // app opened or returned from background
      if (status === 'opened' || status === 'active') {
        updateSession({ isSyncing: true });
        syncSince();
        telemetry.captureAppActive();
        checkNodeStopped();
        refreshHostingAuth();
        checkAnalyticsDigest();
      }

      // app returned from background
      if (status === 'active') {
        setTimeout(() => {
          sync.syncPinnedItems({ priority: sync.SyncPriority.High });
        }, 100);
      }

      // app opened
      if (status === 'opened') {
        db.headsSyncedAt.resetValue().then(() => {
          sync.syncLatestPosts({ priority: sync.SyncPriority.High });
        });
      }
    },
    [checkNodeStopped, telemetry]
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
    configureClient();
    sync.syncStart();
    setClientReady(true);
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
