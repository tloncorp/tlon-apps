import { ZStack } from '@tloncorp/ui';

import { WebviewPositionProvider } from '../contexts/webview/position';
import { WebviewProvider } from '../contexts/webview/webview';
import { useDeepLinkListener } from '../hooks/useDeepLink';
import useNotificationListener from '../hooks/useNotificationListener';
import { TabStack } from '../navigation/TabStack';
import WebviewOverlay from './WebviewOverlay';

export interface AuthenticatedAppProps {
  initialWer?: string;
}

function AuthenticatedApp({ initialWer }: AuthenticatedAppProps) {
  useNotificationListener();
  useDeepLinkListener(initialWer);

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
