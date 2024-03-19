import { initializeUrbitClient } from '@tloncorp/shared/dist/api/urbit';
import { subscribeUnreads } from '@tloncorp/shared/src/api/subscribe';
import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';

import { useShip } from '../contexts/ship';
import { WebviewPositionProvider } from '../contexts/webview/position';
import { WebviewProvider } from '../contexts/webview/webview';
import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener from '../hooks/useNotificationListener';
import {
  syncContacts,
  syncGroups,
  syncPinnedGroups,
  syncUnreads,
} from '../lib/sync';
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
    syncContacts();
    syncUnreads();
    subscribeUnreads();
    syncGroups();
    syncPinnedGroups();
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
