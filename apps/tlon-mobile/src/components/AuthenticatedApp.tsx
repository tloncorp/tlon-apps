import { useShip } from '@tloncorp/app/contexts/ship';
import { useAppStatusChange } from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useFindSuggestedContacts } from '@tloncorp/app/hooks/useFindSuggestedContacts';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import { useUpdatePresentedNotifications } from '@tloncorp/app/lib/notifications';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { sync } from '@tloncorp/shared';
import { PortalProvider, ZStack } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { AppStateStatus } from 'react-native';

import { useCheckAppUpdated } from '../hooks/analytics';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';

function AuthenticatedApp() {
  const telemetry = useTelemetry();
  useNotificationListener();
  useUpdatePresentedNotifications();
  useDeepLinkListener();
  useNavigationLogging();
  useNetworkLogger();
  useCheckAppUpdated();
  useFindSuggestedContacts();

  const handleAppStatusChange = useCallback(
    (status: AppStateStatus) => {
      if (status === 'active') {
        sync.syncUnreads({ priority: sync.SyncPriority.High });
        sync.syncPinnedItems({ priority: sync.SyncPriority.High });
        telemetry.captureAppActive();
      }
    },
    [telemetry]
  );

  useAppStatusChange(handleAppStatusChange);

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
    <AppDataProvider>
      {/* 
        This portal provider overrides the root portal provider 
        to ensure that sheets have access to `AppDataContext`
      */}
      <PortalProvider>{clientReady && <AuthenticatedApp />}</PortalProvider>
    </AppDataProvider>
  );
}
