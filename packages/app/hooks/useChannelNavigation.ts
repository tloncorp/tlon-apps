import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../navigation/types';

export const useChannelNavigation = ({ channelId }: { channelId: string }) => {
  // Model context
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });

  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
    >();

  const navigateToPost = useCallback(
    (post: db.Post) => {
      navigation.push('Post', { post });
    },
    [navigation]
  );

  const navigateToRef = useCallback(
    (channel: db.Channel, post: db.Post) => {
      if (channel.id === channelId) {
        navigation.navigate('Channel', {
          channelId: channel.id,
          selectedPostId: post.id,
        });
      } else {
        navigation.replace('Channel', {
          channelId: channel.id,
          selectedPostId: post.id,
        });
      }
    },
    [navigation, channelId]
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
    });
  }, [navigation, channelQuery.data]);

  return {
    navigateToPost,
    navigateToRef,
    navigateToImage,
    navigateToSearch,
  };
};
