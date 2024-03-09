import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { parseActiveTab } from '@tloncorp/shared';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useEffect, useState } from 'react';

import { useWebViewContext } from '../contexts/webview/webview';
import { markChatRead } from '../lib/chatApi';
import { connectNotifications } from '../lib/notifications';
import type { TabParamList } from '../types';
import { getPathFromWer } from '../utils/string';

export default function useNotificationListener(initialWer?: string) {
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const webviewContext = useWebViewContext();
  const [gotoPath, setGotoPath] = useState(
    initialWer ? getPathFromWer(initialWer) : ''
  );

  // Start notifications prompt
  useEffect(() => {
    connectNotifications();
  }, []);

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
          // TODO: Send reply
        } else if (data.wer) {
          setGotoPath(getPathFromWer(data.wer));
        }
      }
    );

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [navigation, webviewContext]);

  // If notification tapped, broadcast that navigation update to the
  // webview and mark as handled
  useEffect(() => {
    if (gotoPath && webviewContext.appLoaded) {
      console.debug(
        '[useNotificationListener] Setting webview path:',
        gotoPath
      );
      webviewContext.setGotoPath(gotoPath);
      const tab = parseActiveTab(gotoPath) ?? 'Groups';
      navigation.navigate(tab, { screen: 'Webview' });
      setGotoPath('');
    }
  }, [gotoPath, webviewContext, navigation]);
}
