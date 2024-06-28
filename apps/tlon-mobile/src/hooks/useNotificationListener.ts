import type { NavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { syncDms, syncGroups } from '@tloncorp/shared';
import { markChatRead } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { whomIsDm, whomIsMultiDm } from '@tloncorp/shared/dist/urbit';
import { addNotificationResponseReceivedListener } from 'expo-notifications';
import { useEffect, useState } from 'react';

import { connectNotifications } from '../lib/notifications';
import type { HomeStackParamList } from '../types';
import { getIsDmFromWer, getPostIdFromWer } from '../utils/string';

export type Props = {
  notificationPath?: string;
  notificationChannelId?: string;
};

export default function useNotificationListener({
  notificationPath,
  notificationChannelId,
}: Props) {
  const navigation = useNavigation<NavigationProp<HomeStackParamList>>();
  const [{ postId, channelId, isDm }, setGotoData] = useState<{
    path?: string;
    isDm?: boolean;
    postId?: string | null;
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
        const postId = getPostIdFromWer(data.wer);
        const isDm = getIsDmFromWer(data.wer);
        if (actionIdentifier === 'markAsRead' && data.channelId) {
          markChatRead(data.channelId);
        } else if (actionIdentifier === 'reply' && userText) {
          // TODO: Send reply
        } else if (data.channelId) {
          setGotoData({
            path: data.wer,
            isDm,
            postId,
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
        if (postId) {
          let postToNavigateTo: db.Post | null = null;
          if (isDm) {
            // for DMs, we get the backend ID (seal time) of the thread reply itself. So first we have to try to find that,
            // then we grab the parent
            const post = await db.getPostByBackendTime({ backendTime: postId });
            if (post && post.parentId) {
              const parentPost = await db.getPost({ postId: post.parentId });
              if (parentPost) {
                postToNavigateTo = parentPost;
              }
            }
          } else {
            // for group posts, we get the correct post ID and can just try to grab it
            const post = await db.getPost({ postId });
            if (post) {
              postToNavigateTo = post;
            }
          }

          // if we found the post, navigate to it. Otherwise fallback to channel
          if (postToNavigateTo) {
            navigation.navigate('Post', { post: postToNavigateTo });
            resetGotoData();
            return true;
          }
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
  }, [channelId, postId, navigation, isDm]);
}
