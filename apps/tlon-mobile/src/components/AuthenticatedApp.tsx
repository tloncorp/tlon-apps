import { useShip } from '@tloncorp/app/contexts/ship';
import { useAppStatusChange } from '@tloncorp/app/hooks/useAppStatusChange';
import { useConfigureUrbitClient } from '@tloncorp/app/hooks/useConfigureUrbitClient';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useNavigationLogging } from '@tloncorp/app/hooks/useNavigationLogger';
import { useNetworkLogger } from '@tloncorp/app/hooks/useNetworkLogger';
import { useTelemetry } from '@tloncorp/app/hooks/useTelemetry';
import { useUpdatePresentedNotifications } from '@tloncorp/app/lib/notifications';
import { RootStack } from '@tloncorp/app/navigation/RootStack';
import { AppDataProvider } from '@tloncorp/app/provider/AppDataProvider';
import { sync } from '@tloncorp/shared';
import { ZStack } from '@tloncorp/ui';
import { useCallback, useEffect } from 'react';
import { AppStateStatus } from 'react-native';

import { useCheckAppUpdated } from '../hooks/analytics';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useFindContactSuggestions from '../hooks/useFindContactSuggestions';
import useNotificationListener from '../hooks/useNotificationListener';

function AuthenticatedApp() {
  const shipInfo = useShip();
  const { ship, shipUrl } = shipInfo;
  const currentUserId = useCurrentUserId();
  const configureClient = useConfigureUrbitClient();
  const telemetry = useTelemetry();
  useNotificationListener();
  useUpdatePresentedNotifications();
  useDeepLinkListener();
  useNavigationLogging();
  useNetworkLogger();
  useCheckAppUpdated();
  useFindContactSuggestions();

  useEffect(() => {
    configureClient();
    sync.syncStart();
  }, [currentUserId, ship, shipUrl]);

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
  return (
    <AppDataProvider>
      <AuthenticatedApp />
    </AppDataProvider>
  );
}
