import { sync, useStorage } from '@tloncorp/shared';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { useShip } from '../contexts/ship';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { configureClient } from '../lib/api';
import { RootStack } from '../navigation/RootStack';

export interface AuthenticatedAppProps {
  initialNotificationPath?: string;
}

function AuthenticatedApp({ initialNotificationPath }: AuthenticatedAppProps) {
  const { ship, shipUrl } = useShip();
  useNotificationListener(initialNotificationPath);
  useDeepLinkListener();

  useEffect(() => {
    configureClient(ship ?? '', shipUrl ?? '');
    sync.start().catch((e) => {
      console.warn('Sync failed', e);
    });
    useStorage.getState().start();
  }, [ship, shipUrl]);

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
