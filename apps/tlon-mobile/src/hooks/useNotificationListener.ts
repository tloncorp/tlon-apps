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

export default function useNotificationListener(initialNotifPath?: string) {
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const webviewContext = useWebViewContext();
  const [gotoPath, setGotoPath] = useState<string | null>(
    initialNotifPath ?? null
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
          const notifPath = getPathFromWer(data.wer);
          setGotoPath(notifPath);
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
      const tab = parseActiveTab(gotoPath) ?? 'Groups';
      webviewContext.setGotoTab(tab);
      webviewContext.setGotoPath(gotoPath);
      setGotoPath(null);
    }
  }, [gotoPath, webviewContext, navigation]);
}
