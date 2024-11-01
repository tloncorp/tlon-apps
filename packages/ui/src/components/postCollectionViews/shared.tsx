import { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { ComponentPropsWithoutRef, useMemo } from 'react';

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
      hideAuthors: JSONValue.asBoolean(cfg.hideAuthors, false),
      hideReplies: JSONValue.asBoolean(cfg.hideReplies, false),
    };
  }, [ctx.collectionConfiguration]);

  const postProps = useMemo(
    () => ({
      // TODO: useLivePost?
      post,
      onPress: ctx.goToPost,
      isHighlighted: ctx.selectedPostId === post.id,
      onPressRetry: () => ctx.onPressRetry(post),
      onPressDelete: () => ctx.onPressDelete(post),

      // TODO: more props to get parity with BaseScrollerItem

      ...overrides,

      showAuthor: !standardConfig?.hideAuthors,
      showReplies: !standardConfig?.hideReplies,
    }),
    [ctx, post, overrides, standardConfig]
  );

  return <PostView {...postProps} />;
}
