import { ZStack } from '@tloncorp/ui';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useShip } from '../contexts/ship';
import { WebviewPositionProvider } from '../contexts/webview/position';
import {
  WebviewProvider,
  useWebViewContext,
} from '../contexts/webview/webview';
import { useDeepLink } from '../hooks/useDeepLink';
import useNotificationListener from '../hooks/useNotificationListener';
import { inviteShipWithLure } from '../lib/hostingApi';
import { TabStack } from '../navigation/TabStack';
import { trackError } from '../utils/posthog';
import WebviewOverlay from './WebviewOverlay';

export interface AuthenticatedAppProps {
  initialWer?: string;
}

function AuthenticatedApp({ initialWer }: AuthenticatedAppProps) {
  useNotificationListener();
  const { ship } = useShip();
  const { wer, lure, clearDeepLink } = useDeepLink();
  const webviewContext = useWebViewContext();
  const gotoPath = wer ?? initialWer;

  // If lure is present, invite it and mark as handled
  useEffect(() => {
    if (ship && lure) {
      (async () => {
        try {
          await inviteShipWithLure({ ship, lure });
          Alert.alert(
            '',
            'Your invitation to the group is on its way. It will appear in the Groups list.',
            [
              {
                text: 'OK',
                onPress: () => null,
              },
            ],
            { cancelable: true }
          );
        } catch (err) {
          console.error('Error inviting ship with lure:', err);
          if (err instanceof Error) {
            trackError(err);
          }
        }

        clearDeepLink();
      })();
    }
  }, [ship, lure, clearDeepLink]);

  // If deep link clicked, broadcast that navigation update to the
  // webview and mark as handled
  useEffect(() => {
    if (gotoPath) {
      webviewContext.setGotoPath(gotoPath);
      clearDeepLink();
    }
  }, [gotoPath, clearDeepLink, webviewContext]);

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
