import type { NotificationResponse } from 'expo-notifications';

import { markChatRead } from '../lib/chatApi';

export const handleNotificationResponse = (response: NotificationResponse) => {
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
  }
};
