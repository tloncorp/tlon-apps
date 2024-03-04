import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useEffect } from 'react';

import { useWebViewContext } from '../contexts/webview/webview';
import { markChatRead } from '../lib/chatApi';
import { useDeepLink } from './useDeepLink';

export default function useNotificationListener() {
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
          // TODO: handle wer
          // setUri((curr) => ({
          //   ...curr,
          //   uri: createUri(shipUrl, data.wer),
          //   key: curr.key + 1,
          // }));
          webviewContext.setGotoPath(data.wer);
          clearDeepLink();
        }
      }
    );

    // connectNotifications();

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [clearDeepLink, webviewContext]);
}
