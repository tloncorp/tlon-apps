import { sync, useStorage } from '@tloncorp/shared';
import { QueryClientProvider, queryClient } from '@tloncorp/shared/dist/api';
import { AppContextProvider, ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import { useIsDarkMode } from '../hooks/useIsDarkMode';
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
  const currentUserId = useCurrentUserId();
  const dark = useIsDarkMode();

  return (
    <QueryClientProvider client={queryClient}>
      <AppContextProvider
        value={{ currentUserId, theme: dark ? 'dark' : 'light' }}
      >
        <AuthenticatedApp {...props} />
      </AppContextProvider>
    </QueryClientProvider>
  );
}
