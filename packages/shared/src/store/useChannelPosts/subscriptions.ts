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

type DeletedPostListener = (postId: string, isDeleted: boolean) => void;

const deletedPostListeners: DeletedPostListener[] = [];

const useDeletedPostListener = (listener: DeletedPostListener) => {
  useEffect(() => {
    deletedPostListeners.push(listener);
    return () => {
      const index = deletedPostListeners.indexOf(listener);
      if (index !== -1) {
        deletedPostListeners.splice(index, 1);
      }
    };
  }, [listener]);
};

export const useDeletedPosts = (channelId: string) => {
  const [deletedPosts, setDeletedPosts] = useState<Record<string, boolean>>({});
  const handleDeletedPost = useCallback(
    (postId: string, isDeleted: boolean) => {
      setDeletedPosts((value) => ({ ...value, [postId]: isDeleted }));
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

export const rollbackDeletedChannelPost = (post: db.Post) => {
  deletedPostListeners.forEach((listener) => listener(post.id, false));
};
