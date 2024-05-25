import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { markChatRead } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { syncDms, syncGroups } from 'packages/shared/dist';
import { whomIsDm, whomIsMultiDm } from 'packages/shared/dist/urbit';
import { useEffect, useState } from 'react';

import { connectNotifications } from '../lib/notifications';
import type { HomeStackParamList } from '../types';

export type Props = {
  notificationPath?: string;
  notificationChannelId?: string;
};

export default function useNotificationListener({
  notificationPath,
  notificationChannelId,
}: Props) {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
  const [gotoData, setGotoData] = useState<{
    path?: string;
    channelId?: string;
  }>({
    path: notificationPath,
    channelId: notificationChannelId,
  });

  const resetGotoData = () =>
    setGotoData({ path: undefined, channelId: undefined });

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
        } else if (data.channelId) {
          setGotoData({
            path: data.wer,
            channelId: data.channelId,
          });
        }
      }
    );

    return () => {
      // Clean up listeners
      notificationTapListener.remove();
    };
  }, [navigation]);

  // If notification tapped, push channel on stack
  useEffect(() => {
    const { channelId } = gotoData;
    if (channelId) {
      const goToChannel = async () => {
        const channel = await db.getChannel({ id: channelId });
        if (!channel) {
          return false;
        }

        // TODO: parse path and convert it to Post ID to navigate to selected post or thread

        navigation.navigate('Channel', { channel });
        resetGotoData();
        return true;
      };

      (async () => {
        // First check if we have this channel in local store
        let didNavigate = await goToChannel();

        // If not, sync from source and try again
        if (!didNavigate) {
          if (whomIsDm(channelId) || whomIsMultiDm(channelId)) {
            await syncDms();
          } else {
            await syncGroups();
          }

          didNavigate = await goToChannel();

          // If still not found, clear out the requested channel ID
          if (!didNavigate) {
            resetGotoData();
          }
        }
      })();
    }
  }, [gotoData, navigation]);
}
