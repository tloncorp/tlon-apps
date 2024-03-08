import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
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
import type { TabParamList } from '../types';
import { trackError } from '../utils/posthog';
import { getPathFromWer } from '../utils/string';
import WebviewOverlay from './WebviewOverlay';

export interface AuthenticatedAppProps {
  initialWer?: string;
}

function AuthenticatedApp({ initialWer }: AuthenticatedAppProps) {
  useNotificationListener();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const { ship } = useShip();
  const { wer, lure, clearDeepLink } = useDeepLink();
  const webviewContext = useWebViewContext();
  const gotoPath = initialWer
    ? getPathFromWer(initialWer)
    : wer
      ? getPathFromWer(wer)
      : '';

  if (initialWer) {
    Alert.alert(
      '',
      `Auth app got initial wer: ${initialWer}`,
      [
        {
          text: 'OK',
          onPress: () => null,
        },
      ],
      { cancelable: true }
    );
  }

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
      console.log(`wer gotopath set: ${gotoPath}`);
      webviewContext.setGotoPath(gotoPath);
      navigation.navigate('Groups', { screen: 'Webview' });
      clearDeepLink();
    }
  }, [gotoPath, clearDeepLink, webviewContext, navigation]);

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
