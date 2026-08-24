import { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ComponentPropsWithoutRef, useCallback, useMemo } from 'react';

import { useLivePost } from '../../../hooks/useLivePost';
import { useCurrentUserId } from '../../contexts/appDataContext';
import type { RenderItemType } from '../../contexts/componentsKits';
import { usePostCollectionContext } from '../../contexts/postCollection';
import { PostView } from '../Channel/PostView';
import { getA2UIActionCompletion } from '../ChatMessage/a2uiActionCompletion';
import { IPostCollectionView, PostCollectionHandle } from './types';

export type { IPostCollectionView, PostCollectionHandle };

export function ConnectedPostView({
  post,
  ...overrides
}: { post: db.Post } & Partial<ComponentPropsWithoutRef<typeof PostView>>) {
  const ctx = usePostCollectionContext();
  const currentUserId = useCurrentUserId();

  // this code is duplicated in packages/ui/components/Channel/PostView.tsx
  const standardConfig = useMemo(() => {
    const cfg = ctx.collectionConfiguration;
    if (cfg == null) {
      return null;
    }
    return {
      showAuthor: JSONValue.asBoolean(cfg.showAuthor, false),
      showReplies: JSONValue.asBoolean(cfg.showReplies, false),
    };
  }, [ctx.collectionConfiguration]);

  const editPost = useCallback<
    Exclude<ComponentPropsWithoutRef<RenderItemType>['editPost'], undefined>
  >(async (post, content) => {
    await store.editPost({
      post,
      content,
    });
  }, []);

  const livePost = useLivePost(post);
  const a2uiActionCompletion = useMemo(() => {
    const postIndex = ctx.posts?.findIndex(
      (candidate) => candidate.id === livePost.id
    );
    return getA2UIActionCompletion(
      postIndex == null || postIndex < 0
        ? []
        : (ctx.posts?.slice(0, postIndex) ?? []),
      currentUserId
    );
  }, [ctx.posts, currentUserId, livePost.id]);

  const postProps = useMemo(
    () => ({
      post: livePost,
      a2uiActionCompletion,
      onPress: ctx.goToPost,
      isHighlighted: ctx.selectedPostId === livePost.id,
      onPressRetry: () => ctx.onPressRetrySend(livePost),
      onPressDelete: () => ctx.onPressDelete(livePost),
      editPost,

      // TODO: more props to get parity with BaseScrollerItem

      ...overrides,

      ...(standardConfig ?? {}),
    }),
    [ctx, livePost, overrides, standardConfig, editPost, a2uiActionCompletion]
  );

  return <PostView {...postProps} />;
}
