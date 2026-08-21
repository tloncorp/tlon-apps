import { parsePostBlob } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { getPinnedPostId } from '@tloncorp/shared/logic';
import { forwardRef, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { View, YStack } from 'tamagui';

import {
  PostCollectionContext,
  usePostCollectionContext,
} from '../../contexts/postCollection';
import { ListPostCollection } from './ListPostCollectionView';
import { ConnectedPostView, IPostCollectionView } from './shared';

function carriesInteractiveSurface(post: db.Post): boolean {
  if (!post.blob || post.isDeleted) {
    return false;
  }
  try {
    return parsePostBlob(post.blob).some(
      (entry) => entry.type === 'interactive-surface'
    );
  } catch {
    return false;
  }
}

/**
 * The post the surface area shows: the channel's pinned post when it is
 * loaded and carries a surface, else the newest loaded post that does. The
 * heuristic exists because nothing pins the card automatically today — the
 * agent posts it and edits it in place, so "the newest surface post" is the
 * current card by construction, and a genuinely pinned post simply wins.
 */
export function selectSurfacePost(
  posts: db.Post[] | null | undefined,
  channel: db.Channel
): db.Post | null {
  if (posts == null || posts.length === 0) {
    return null;
  }
  const pinnedId = getPinnedPostId(channel);
  if (pinnedId != null) {
    const pinned = posts.find((post) => post.id === pinnedId);
    if (pinned != null && carriesInteractiveSurface(pinned)) {
      return pinned;
    }
  }
  let newest: db.Post | null = null;
  for (const post of posts) {
    if (!carriesInteractiveSurface(post)) {
      continue;
    }
    if (newest == null || (post.receivedAt ?? 0) > (newest.receivedAt ?? 0)) {
      newest = post;
    }
  }
  return newest;
}

/**
 * A chat channel bifurcated into a mini-app and a conversation: the channel's
 * current interactive-surface card sits in a fixed area at the top, and the
 * ordinary chat list flows beneath it. The surface renders through the
 * standard post path, so its buttons work and the agent's in-place edits
 * re-render it live; the card is filtered out of the flowing list so it does
 * not appear twice. With no surface post loaded this is exactly the chat
 * list. See docs/tlon-apps/channel-views.md for how a channel declares this
 * view and how clients without it degrade.
 */
export const PinnedSurfaceCollection: IPostCollectionView = forwardRef(
  function PinnedSurfaceCollection(_props, forwardedRef) {
    const ctx = usePostCollectionContext();
    const surfacePost = useMemo(
      () => selectSurfacePost(ctx.posts, ctx.channel),
      [ctx.posts, ctx.channel]
    );
    const flowingCtx = useMemo(
      () =>
        surfacePost == null
          ? ctx
          : {
              ...ctx,
              posts: ctx.posts?.filter((post) => post.id !== surfacePost.id),
            },
      [ctx, surfacePost]
    );
    if (surfacePost == null) {
      return <ListPostCollection ref={forwardedRef} />;
    }
    return (
      <YStack flex={1}>
        <View
          maxHeight="55%"
          flexShrink={0}
          borderBottomWidth={1}
          borderColor="$border"
          backgroundColor="$background"
        >
          <ScrollView>
            <ConnectedPostView post={surfacePost} showAuthor={false} />
          </ScrollView>
        </View>
        <View flex={1} minHeight={0}>
          <PostCollectionContext.Provider value={flowingCtx}>
            <ListPostCollection ref={forwardedRef} />
          </PostCollectionContext.Provider>
        </View>
      </YStack>
    );
  }
);
