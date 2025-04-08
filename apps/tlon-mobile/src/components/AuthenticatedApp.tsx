import {
  AppStatus,
  useAppStatusChange,
} from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { usePersonalGroup } from '@tloncorp/app/hooks/usePersonalGroup';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import { useUpdatePresentedNotifications } from '@tloncorp/app/lib/notifications';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { PortalProvider, ZStack } from '@tloncorp/app/ui';
import { SplashSequence } from '@tloncorp/app/ui/components/Wayfinding/SplashSequence';
import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useState } from 'react';

import { checkAnalyticsDigest, useCheckAppUpdated } from '../hooks/analytics';
import { useCheckNodeStopped } from '../hooks/useCheckNodeStopped';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { refreshHostingAuth } from '../lib/hostingAuth';

function AuthenticatedApp() {
  const telemetry = useTelemetry();
  const checkNodeStopped = useCheckNodeStopped();
  useNotificationListener();
  useUpdatePresentedNotifications();
  useDeepLinkListener();
  useNavigationLogging();
  useNetworkLogger();
  useCheckAppUpdated();
  useFindSuggestedContacts();
  usePersonalGroup();

  const handleAppStatusChange = useCallback(
    (status: AppStatus) => {
      // app returned from background
      if (status === 'active') {
        sync.syncUnreads({ priority: sync.SyncPriority.High });
        sync.syncPinnedItems({ priority: sync.SyncPriority.High });
      }

      // app opened
      if (status === 'opened') {
        db.headsSyncedAt.resetValue().then(() => {
          sync.syncLatestPosts({ priority: sync.SyncPriority.High });
        });
      }

      // app opened or returned from background
      if (status === 'opened' || status === 'active') {
        telemetry.captureAppActive();
        checkNodeStopped();
        refreshHostingAuth();
        checkAnalyticsDigest();
      }
    },
    [checkNodeStopped, telemetry]
  );

  useAppStatusChange(handleAppStatusChange);

  useEffect(() => {
    // reset this anytime we get back into the authenticated app
    db.nodeStoppedWhileLoggedIn.setValue(false);
  }, []);

  const showSplash = db.showWayfindingSplash.useValue();

  return (
    <ZStack flex={1}>
      {showSplash ? <SplashSequence onCompleted={() => {}} /> : <RootStack />}
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
    <AppDataProvider>
      {/* 
        This portal provider overrides the root portal provider 
        to ensure that sheets have access to `AppDataContext`
      */}
      <PortalProvider>{clientReady && <AuthenticatedApp />}</PortalProvider>
    </AppDataProvider>
  );
}
