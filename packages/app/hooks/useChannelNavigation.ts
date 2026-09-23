import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../navigation/types';
import { useRootNavigation } from '../navigation/utils';
import { getPostImageViewerId } from '../utils/mediaViewer';

const logger = createDevLogger('useChannelNavigation', false);

export const useChannelNavigation = ({ channelId }: { channelId: string }) => {
  const channelQuery = store.useChannel({
    id: channelId,
  });

  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        RootStackParamList,
        'Channel' | 'Post' | 'MediaViewer'
      >
    >();

  const { navigateToPost, navigateToChannel } = useRootNavigation();

  const navigateToRef = useCallback(
    async (channel: db.Channel, post: db.Post) => {
      if (channel.type === 'chat') {
        // Chat thread reply: navigate to the parent thread with this reply
        // selected, instead of the main channel (where the reply is not
        // visible as a top-level post).
        if (post.parentId) {
          try {
            // Look up the parent post locally for its authorId. For group
            // channels (the scope of this fix), authorId is not used in the
            // API path, so falling back to the reply's authorId is safe —
            // PostScreen.syncThreadPosts will fetch the parent from the API.
            const parentPost = await db.getPost({ postId: post.parentId });
            const parentAuthorId = parentPost?.authorId ?? post.authorId;
            navigateToPost(
              {
                id: post.parentId,
                channelId: post.channelId,
                groupId: post.groupId,
                authorId: parentAuthorId,
              } as db.Post,
              { selectedPostId: post.id }
            );
            return;
          } catch (e) {
            logger.log('navigateToRef: error resolving parent post', e);
            // Still navigate to parent thread — authorId placeholder is
            // safe for group channels.
            navigateToPost(
              {
                id: post.parentId,
                channelId: post.channelId,
                groupId: post.groupId,
                authorId: post.authorId,
              } as db.Post,
              { selectedPostId: post.id }
            );
            return;
          }
        }
        navigateToChannel(channel, post.id);
      } else {
        navigateToPost(post);
      }
    },
    [navigateToChannel, navigateToPost]
  );

  const navigateToImage = useCallback(
    (post: db.Post, uri?: string) => {
      navigation.navigate('MediaViewer', {
        mediaType: 'image',
        uri,
        viewerId: getPostImageViewerId(post.id, uri),
      });
    },
    [navigation]
  );

  const { navigation: rootNavigation } = useRootNavigation();
  // Mounted as the BotChat tab, the nearest navigator is the tab bar, which
  // has no push(); those screens live on the root stack, so go there instead.
  const pushScreen = useCallback(
    <Name extends keyof RootStackParamList>(
      name: Name,
      params: RootStackParamList[Name]
    ) => {
      const stack = navigation as { push?: unknown };
      if (typeof stack.push === 'function') {
        (navigation.push as (n: Name, p: RootStackParamList[Name]) => void)(
          name,
          params
        );
        return;
      }
      (
        rootNavigation.navigate as (
          n: Name,
          p: RootStackParamList[Name]
        ) => void
      )(name, params);
    },
    [navigation, rootNavigation]
  );

  const navigateToSearch = useCallback(() => {
    if (!channelQuery.data) {
      return;
    }
    pushScreen('ChannelSearch', {
      channelId: channelQuery.data.id ?? null,
      groupId: channelQuery.data.groupId ?? '',
    });
  }, [pushScreen, channelQuery.data]);

  const navigateToContextLensRuns = useCallback(() => {
    pushScreen('ContextLensRuns', { channelId });
  }, [pushScreen, channelId]);

  const navigateToContextLensRun = useCallback(
    ({ botShip, lensId }: { botShip: string; lensId: string }) => {
      pushScreen('ContextLensRun', { botShip, lensId, channelId });
    },
    [pushScreen, channelId]
  );

  return {
    navigateToPost,
    navigateToRef,
    navigateToImage,
    navigateToSearch,
    navigateToContextLensRuns,
    navigateToContextLensRun,
  };
};
