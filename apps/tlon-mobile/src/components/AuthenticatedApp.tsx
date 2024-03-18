import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import { WebviewPositionProvider } from '../contexts/webview/position';
import { WebviewProvider } from '../contexts/webview/webview';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import { initializeUrbitClient } from '../lib/api';
import { subscribeUnreads } from '../lib/subscribe';
import { syncContacts, syncGroups, syncUnreads } from '../lib/sync';
import { TabStack } from '../navigation/TabStack';
import WebviewOverlay from './WebviewOverlay';

export interface AuthenticatedAppProps {
  initialNotificationPath?: string;
}

function AuthenticatedApp({ initialNotificationPath }: AuthenticatedAppProps) {
  const { ship, shipUrl } = useShip();
  useNotificationListener(initialNotificationPath);
  useDeepLinkListener();

  useEffect(() => {
    initializeUrbitClient(ship ?? '', shipUrl ?? '');
    syncGroups();
    syncContacts();
    syncUnreads();
    subscribeUnreads();
  }, [ship, shipUrl]);

  return (
    <ZStack flex={1}>
      <TabStack />
      <WebviewOverlay />
    </ZStack>
  );
}

export default function ConnectedAuthenticatedApp(
  props: AuthenticatedAppProps
) {
  return (
    <WebviewPositionProvider>
      <WebviewProvider>
        <AuthenticatedApp {...props} />
      </WebviewProvider>
    </WebviewPositionProvider>
  );
}
