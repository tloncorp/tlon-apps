import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
// import { parseActiveTab } from '@tloncorp/shared';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useBranch } from '../contexts/branch';
import { useShip } from '../contexts/ship';
import { inviteShipWithLure } from '../lib/hostingApi';
import type { TabParamList } from '../types';
import { trackError } from '../utils/posthog';

export const useDeepLinkListener = () => {
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const { ship } = useShip();
  const { lure, deepLinkPath, clearLure, clearDeepLink } = useBranch();

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
          console.error(
            '[useDeepLinkListener] Error inviting ship with lure:',
            err
          );
          if (err instanceof Error) {
            trackError(err);
          }
        }

        clearLure();
      })();
    }
  }, [ship, lure, clearLure]);

  // If deep link clicked, broadcast that navigation update to the webview and mark as handled
  useEffect(() => {
    // TODO: hook up deep links without webview
    // if (deepLinkPath && webviewContext.appLoaded) {
    // console.debug(
    // '[useDeepLinkListener] Setting webview path:',
    // deepLinkPath
    // );
    // webviewContext.setGotoPath(deepLinkPath);
    // const tab = parseActiveTab(deepLinkPath) ?? 'Groups';
    // navigation.navigate(tab, { screen: 'Webview' });
    // clearDeepLink();
    // }
  }, [deepLinkPath, navigation, clearDeepLink]);
};
