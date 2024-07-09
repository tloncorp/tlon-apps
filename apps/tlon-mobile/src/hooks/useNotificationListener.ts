import type { NavigationProp } from '@react-navigation/native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { syncDms, syncGroups } from '@tloncorp/shared';
import { markChatRead } from '@tloncorp/shared/dist/api';
import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { whomIsDm, whomIsMultiDm } from '@tloncorp/shared/dist/urbit';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useEffect, useState } from 'react';

import { connectNotifications } from '../lib/notifications';
import type { RootStackParamList } from '../types';

export type Props = {
  notificationPath?: string;
  notificationChannelId?: string;
};

export default function useNotificationListener({
  notificationPath,
  notificationChannelId,
}: Props) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [{ postInfo, channelId, isDm }, setGotoData] = useState<{
    path?: string;
    isDm?: boolean;
    postInfo?: { id: string; authorId: string } | null;
    channelId?: string;
  }>({
    path: notificationPath,
    channelId: notificationChannelId,
  });

  const resetGotoData = () =>
    setGotoData({ path: undefined, channelId: undefined, postInfo: undefined });

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
        const postInfo = api.getPostInfoFromWer(data.wer);
        const isDm = api.getIsDmFromWer(data.wer);
        if (actionIdentifier === 'markAsRead' && data.channelId) {
          markChatRead(data.channelId);
        } else if (actionIdentifier === 'reply' && userText) {
          // TODO: this is unhandled, when is actionIdentifier = reply?
        } else if (data.channelId) {
          setGotoData({
            path: data.wer,
            isDm,
            postInfo,
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
    if (channelId) {
      const goToChannel = async () => {
        const channel = await db.getChannel({ id: channelId });
        if (!channel) {
          return false;
        }

        // if we have a post id, try to navigate to the thread
        if (postInfo) {
          let postToNavigateTo: {
            id: string;
            authorId: string;
            channelId: string;
          } | null = null;

          console.log(`bl: grabbing post`, postInfo.id);
          const post = await db.getPost({ postId: postInfo.id });

          if (post) {
            console.log(`bl: got it, trying`, post);
            postToNavigateTo = post;
          } else {
            console.log(`bl: didnt find the post, using stub`);
            postToNavigateTo = { ...postInfo, channelId };
          }

          navigation.dispatch(
            CommonActions.reset({
              index: 1,
              routes: [
                { name: 'ChatList' },
                { name: 'Channel', params: { channel } },
                { name: 'Post', params: { post: postToNavigateTo } },
              ],
            })
          );
          resetGotoData();
          return true;
        }

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
  }, [channelId, postInfo, navigation, isDm]);
}
