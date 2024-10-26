import * as db from '@tloncorp/shared/dist/db';
import { useEffect } from 'react';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';

// window must stretch from now until some time in the past
export function useLoadPostsInWindow(
  isPostInsideWindow: (post: db.Post) => boolean
) {
  const {
    hasNewerPosts,
    hasOlderPosts,
    onScrollEndReached,
    onScrollStartReached,
    posts,
  } = usePostCollectionContextUnsafelyUnwrapped();

  useEffect(() => {
    if (hasNewerPosts && onScrollStartReached) {
      onScrollStartReached();
    }
  }, [
    hasNewerPosts,
    onScrollStartReached,
    // The other deps don't change when a pagination request completes.
    // Since we want to fetch all newer events, retrigger when `posts` changes.
    posts,
  ]);

  useEffect(() => {
    const needsOlderPostsToFillWindow =
      posts == null ||
      posts.length === 0 ||
      isPostInsideWindow(posts[posts.length - 1]);
    if (needsOlderPostsToFillWindow && hasOlderPosts && onScrollEndReached) {
      onScrollEndReached();
    }
  }, [hasOlderPosts, onScrollEndReached, posts, isPostInsideWindow]);
}
