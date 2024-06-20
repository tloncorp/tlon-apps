import { sync } from '@tloncorp/shared';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import * as logic from '@tloncorp/shared/dist/logic';
import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener, {
  type Props as NotificationListenerProps,
} from '../hooks/useNotificationListener';
import { configureClient } from '../lib/api';
import { RootStack } from '../navigation/RootStack';

export interface AuthenticatedAppProps {
  notificationListenerProps: NotificationListenerProps;
}

function AuthenticatedApp({
  notificationListenerProps,
}: AuthenticatedAppProps) {
  const { ship, shipUrl } = useShip();
  const currentUserId = useCurrentUserId();
  useNotificationListener(notificationListenerProps);
  useDeepLinkListener();

  useEffect(() => {
    configureClient({
      shipName: ship ?? '',
      shipUrl: shipUrl ?? '',
      onReset: () => sync.syncStart(),
    });

    // TODO: remove, for use in Beta testing only
    if (currentUserId) {
      logic.setErrorTrackingUserId(currentUserId);
    }

    sync.syncStart();
  }, [currentUserId, ship, shipUrl]);

  return (
    <ZStack flex={1}>
      <RootStack />
    </ZStack>
  );
}

export default function ConnectedAuthenticatedApp(
  props: AuthenticatedAppProps
) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp {...props} />
    </QueryClientProvider>
  );
}
