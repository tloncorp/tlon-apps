import { parsePostBlob } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { getPinnedPostId } from '@tloncorp/shared/logic';
import { forwardRef, useMemo } from 'react';
import { ScrollView } from 'react-native';
import { View, YStack } from 'tamagui';

import { useLivePost } from '../../../hooks/useLivePost';
import {
  PostCollectionContext,
  usePostCollectionContext,
} from '../../contexts/postCollection';
import { usePostA2UIActions } from '../../hooks/usePostA2UIActions';
import { A2UIBlock } from '../PostContent/A2UIBlock';
import { ContentContext, usePostContent } from '../PostContent/contentUtils';
import { ListPostCollection } from './ListPostCollectionView';
import { IPostCollectionView } from './shared';

function carriesInteractiveSurface(post: db.Post): boolean {
  if (!post.blob || post.isDeleted) {
    return false;
  }
  try {
    const entries = parsePostBlob(post.blob);
    // Both halves must be present: the surface entry alone is data with no
    // view, and an a2ui entry alone is a plain in-stream card. The canvas
    // only pins a post it can actually draw.
    return (
      entries.some((entry) => entry.type === 'interactive-surface') &&
      entries.some((entry) => entry.type === 'a2ui')
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
 * The mini-app itself: the surface post's a2ui tree rendered full bleed — no
 * author row, no timestamp, no message chrome, no card border — with its
 * buttons wired exactly as they are in chat. The post is read live, so the
 * agent's in-place edits re-render the canvas as they sync.
 */
function SurfaceCanvas({ post }: { post: db.Post }) {
  const livePost = useLivePost(post);
  const { onA2UIAction, isA2UIActionAvailable, getA2UIActionState } =
    usePostA2UIActions(livePost);
  const content = usePostContent(livePost);
  const blocks = useMemo(
    () => content.filter((block) => block.type === 'a2ui'),
    [content]
  );
  if (blocks.length === 0) {
    return null;
  }
  return (
    <ContentContext.Provider
      onA2UIAction={onA2UIAction}
      isA2UIActionAvailable={isA2UIActionAvailable}
      getA2UIActionState={getA2UIActionState}
    >
      {blocks.map((block, index) => (
        <A2UIBlock key={index} block={block} fullBleed />
      ))}
    </ContentContext.Provider>
  );
}

/**
 * A chat channel bifurcated into a mini-app and a conversation: the channel's
 * current interactive-surface card fills a fixed area at the top, and the
 * ordinary chat list flows beneath it. The card is filtered out of the
 * flowing list so it does not appear twice; with no surface post loaded this
 * is exactly the chat list. See docs/tlon-apps/channel-views.md for how a
 * channel declares this view and how clients without it degrade.
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
            <SurfaceCanvas post={surfacePost} />
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
