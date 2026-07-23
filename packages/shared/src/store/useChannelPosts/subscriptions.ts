import { useCallback, useEffect, useState } from 'react';

import * as db from '../../db';

// New post listener:
//
// Used to proxy events from post subscription to the hook,
// allowing us to manually add new posts to the query data.

type SubscriptionPost = db.Post;

export type SubscriptionPostListener = (post: SubscriptionPost) => void;

const newPostListeners: SubscriptionPostListener[] = [];

export const useNewPostListener = (listener: SubscriptionPostListener) => {
  useEffect(() => {
    newPostListeners.push(listener);
    return () => {
      const index = newPostListeners.indexOf(listener);
      if (index !== -1) {
        newPostListeners.splice(index, 1);
      }
    };
  }, [listener]);
};

export type DeletedPostState = boolean | 'removed';

type DeletedPostListener = (postId: string, state: DeletedPostState) => void;

const deletedPostListeners: DeletedPostListener[] = [];

export const subscribeToDeletedPosts = (listener: DeletedPostListener) => {
  deletedPostListeners.push(listener);
  return () => {
    const index = deletedPostListeners.indexOf(listener);
    if (index !== -1) {
      deletedPostListeners.splice(index, 1);
    }
  };
};

const useDeletedPostListener = (listener: DeletedPostListener) => {
  useEffect(() => subscribeToDeletedPosts(listener), [listener]);
};

export const useDeletedPosts = (channelId: string) => {
  const [deletedPosts, setDeletedPosts] = useState<
    Record<string, DeletedPostState>
  >({});
  const handleDeletedPost = useCallback(
    (postId: string, state: DeletedPostState) => {
      setDeletedPosts((value) => ({ ...value, [postId]: state }));
    },
    []
  );
  useDeletedPostListener(handleDeletedPost);
  useEffect(() => {
    setDeletedPosts({});
  }, [channelId]);
  return deletedPosts;
};

/**
 * External interface for transmitting new post events to listener
 */
export const addToChannelPosts = (post: SubscriptionPost) => {
  newPostListeners.forEach((listener) => listener(post));
};

export const deleteFromChannelPosts = (post: db.Post) => {
  deletedPostListeners.forEach((listener) => listener(post.id, true));
};

/**
 * Remove a hard-deleted post from the live merge inputs as well as marking it
 * deleted. This is distinct from the optimistic delete signal above: the
 * server outcome is settled, so a stale snapshot in `newPosts` must disappear
 * instead of rendering as a tombstone until remount.
 */
export const removeFromChannelPosts = (post: db.Post) => {
  deletedPostListeners.forEach((listener) => listener(post.id, 'removed'));
};

export const rollbackDeletedChannelPost = (post: db.Post) => {
  deletedPostListeners.forEach((listener) => listener(post.id, false));
};
