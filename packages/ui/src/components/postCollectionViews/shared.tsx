import { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ComponentPropsWithoutRef, useCallback, useMemo } from 'react';

import { RenderItemType } from '../../contexts/componentsKits';
import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { PostView } from '../Channel/PostView';

export interface PostCollectionHandle {
  scrollToPostAtIndex?: (index: number) => void;
}

export type IPostCollectionView = React.ForwardRefExoticComponent<
  React.RefAttributes<PostCollectionHandle>
>;

export function ConnectedPostView({
  post,
  ...overrides
}: { post: db.Post } & Partial<ComponentPropsWithoutRef<typeof PostView>>) {
  const ctx = usePostCollectionContextUnsafelyUnwrapped();

  const standardConfig = useMemo(() => {
    const cfg = ctx.collectionConfiguration;
    if (cfg == null) {
      return null;
    }
    return {
      showAuthor: JSONValue.asBoolean(cfg.showAuthors, false),
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

  const postProps = useMemo(
    () => ({
      // TODO: useLivePost?
      post,
      onPress: ctx.goToPost,
      isHighlighted: ctx.selectedPostId === post.id,
      onPressRetry: () => ctx.onPressRetry(post),
      onPressDelete: () => ctx.onPressDelete(post),
      editPost,

      // TODO: more props to get parity with BaseScrollerItem

      ...overrides,

      showAuthor: standardConfig?.showAuthor,
      showReplies: standardConfig?.showReplies,
    }),
    [ctx, post, overrides, standardConfig, editPost]
  );

  return <PostView {...postProps} />;
}
