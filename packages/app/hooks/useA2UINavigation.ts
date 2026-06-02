import { getCanonicalPostId } from '@tloncorp/api/client';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { A2UI } from '@tloncorp/shared/logic';
import { useCallback } from 'react';

import { useRootNavigation } from '../navigation/utils';

const logger = createDevLogger('a2ui-navigation', false);

function isChatChannel(channel: db.Channel): boolean {
  return ['chat', 'dm', 'groupDm'].includes(channel.type);
}

async function getPost(postId: string): Promise<db.Post | null> {
  try {
    return await db.getPost({ postId });
  } catch (error) {
    logger.log('failed to resolve post', { postId, error });
    return null;
  }
}

async function getChannel(channelId: string): Promise<db.Channel | null> {
  try {
    return await db.getChannel({ id: channelId });
  } catch (error) {
    logger.log('failed to resolve channel', { channelId, error });
    return null;
  }
}

function postFromTarget(
  target: A2UI.MessageNavigationTarget,
  postId: string,
  authorId?: string
): db.Post | null {
  if (!authorId) {
    return null;
  }

  return {
    id: postId,
    channelId: target.channelId,
    groupId: target.groupId,
    authorId,
  } as db.Post;
}

export function useA2UINavigation() {
  const rootNavigation = useRootNavigation();

  const navigateToMessage = useCallback(
    async (target: A2UI.MessageNavigationTarget) => {
      const postId = getCanonicalPostId(target.postId);
      const parentId = target.parentId
        ? getCanonicalPostId(target.parentId)
        : undefined;
      const channel = await getChannel(target.channelId);
      if (!channel) {
        logger.log('missing channel for message target', target);
        return;
      }

      if (isChatChannel(channel)) {
        if (parentId) {
          const parentPost = await getPost(parentId);
          const parentTarget = postFromTarget(
            target,
            parentId,
            parentPost?.authorId ?? target.authorId
          );
          if (!parentTarget) {
            logger.log('missing parent post author for message target', target);
            return;
          }
          rootNavigation.navigateToPost(parentTarget, {
            selectedPostId: postId,
          });
          return;
        }

        rootNavigation.navigateToChannel(channel, postId);
        return;
      }

      const post =
        (await getPost(postId)) ??
        postFromTarget(target, postId, target.authorId);
      if (!post) {
        logger.log('missing post author for message target', target);
        return;
      }

      rootNavigation.navigateToPost(post);
    },
    [rootNavigation]
  );

  return useCallback(
    async (target: A2UI.NavigationTarget) => {
      switch (target.type) {
        case 'message':
          await navigateToMessage(target);
          return;
        case 'channel': {
          const channel = await getChannel(target.channelId);
          if (!channel) {
            logger.log('missing channel target', target);
            return;
          }
          rootNavigation.navigateToChannel(
            channel,
            target.selectedPostId
              ? getCanonicalPostId(target.selectedPostId)
              : undefined
          );
          return;
        }
        case 'group':
          await rootNavigation.navigateToGroup(target.groupId);
          return;
        case 'profile':
          rootNavigation.navigation.navigate('UserProfile', {
            userId: target.userId,
            groupId: target.groupId,
            channelId: target.channelId,
          });
          return;
        case 'chatDetails':
          rootNavigation.navigateToChatDetails({
            type: target.chatType,
            id: target.chatId,
            groupId: target.groupId,
          });
          return;
        case 'chatVolume':
          rootNavigation.navigateToChatVolume({
            type: target.chatType,
            id: target.chatId,
            groupId: target.groupId,
          });
          return;
      }
    },
    [navigateToMessage, rootNavigation]
  );
}
