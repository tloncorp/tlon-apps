import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';

export const useChannelNavigation = ({ channelId }: { channelId: string }) => {
  const channelQuery = store.useChannel({
    id: channelId,
  });

  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
    >();

  const { navigateToPost, navigateToChannel } = useRootNavigation();

  const navigateToRef = useCallback(
    (channel: db.Channel, post: db.Post) => {
      if (channel.id === channelId) {
        navigation.navigate('Channel', {
          channelId: channel.id,
          selectedPostId: post.id,
        });
      } else {
        navigateToChannel(channel, post.id);
      }
    },
    [navigation, channelId, navigateToChannel]
  );

  const navigateToImage = useCallback(
    (post: db.Post, uri?: string) => {
      navigation.navigate('ImageViewer', { uri });
    },
    [navigation]
  );

  const navigateToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    navigation.push('ChannelSearch', {
      channelId: channelQuery.data.id ?? null,
      groupId: channelQuery.data.groupId ?? '',
    });
  }, [navigation, channelQuery.data]);

  return {
    navigateToPost,
    navigateToRef,
    navigateToImage,
    navigateToSearch,
  };
};
