import { useNavigation } from '@react-navigation/native';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback } from 'react';

export const useChannelNavigation = ({ channelId }: { channelId: string }) => {
  // Model context
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });

  const navigation = useNavigation<
    // @ts-expect-error - TODO: pass navigation handlers into context
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
        navigation.navigate('Channel', { channel, selectedPostId: post.id });
      } else {
        navigation.replace('Channel', { channel, selectedPostId: post.id });
      }
    },
    [navigation, channelId]
  );

  const navigateToImage = useCallback(
    (post: db.Post, uri?: string) => {
      navigation.navigate('ImageViewer', { post, uri });
    },
    [navigation]
  );

  const navigateToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    navigation.push('ChannelSearch', {
      channel: channelQuery.data ?? null,
    });
  }, [navigation, channelQuery.data]);

  return {
    navigateToPost,
    navigateToRef,
    navigateToImage,
    navigateToSearch,
  };
};
