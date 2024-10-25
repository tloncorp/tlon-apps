import * as db from '@tloncorp/shared/dist/db';
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
    }),
    [ctx, post, overrides]
  );

  return <PostView {...postProps} />;
}
