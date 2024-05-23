import { sync } from '@tloncorp/shared';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { configureClient } from '../lib/api';
import { RootStack } from '../navigation/RootStack';

export interface AuthenticatedAppProps {
  initialNotificationPath?: string;
}

function AuthenticatedApp({ initialNotificationPath }: AuthenticatedAppProps) {
  const { ship, shipUrl } = useShip();
  const currentUserId = useCurrentUserId();
  useNotificationListener(initialNotificationPath);
  useDeepLinkListener();

  useEffect(() => {
    const start = () => {
      sync.start().catch((e) => {
        console.warn('Sync failed', e);
      });
    };

    configureClient({
      shipName: ship ?? '',
      shipUrl: shipUrl ?? '',
      onReset: () => start(),
    });

    start();
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
