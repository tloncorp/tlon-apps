import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useWebViewContext } from '../contexts/webview/webview';
import { markChatRead } from '../lib/chatApi';
import { connectNotifications } from '../lib/notifications';
import type { TabParamList } from '../types';
import { getPathFromWer } from '../utils/string';
import { useDeepLink } from './useDeepLink';

export default function useNotificationListener() {
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const webviewContext = useWebViewContext();
  const { clearDeepLink } = useDeepLink();

  useEffect(() => {
    // Start notification tap listener
    // This only seems to get triggered on iOS. Android handles the tap and other intents in native code.
    const notificationTapListener = addNotificationResponseReceivedListener(
      (response) => {
        const {
          actionIdentifier,
          userText,
          notification: {
            request: {
              content: { data },
            },
          },
        } = response;
        if (actionIdentifier === 'markAsRead' && data.channelId) {
          markChatRead(data.channelId);
        } else if (actionIdentifier === 'reply' && userText) {
          // Send reply
        } else if (data.wer) {
          webviewContext.setGotoPath(getPathFromWer(data.wer));
          Alert.alert(
            '',
            `Goto path: ${getPathFromWer(data.wer)}`,
            [
              {
                text: 'OK',
                onPress: () => null,
              },
            ],
            { cancelable: true }
          );
          navigation.navigate('Groups', { screen: 'Webview' });
          clearDeepLink();
        }
      }
    );

    connectNotifications();

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [clearDeepLink, navigation, webviewContext]);
}
