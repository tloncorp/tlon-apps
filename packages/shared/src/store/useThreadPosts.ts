import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import * as db from '../db';
import { syncThreadPosts } from './sync';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export const useThreadPosts = ({
  postId,
  channelId,
  authorId,
}: {
  postId: string;
  authorId: string;
  channelId: string;
}) => {
  useEffect(() => {
    // TODO: Check if necessary, based on unreads or reply count
    syncThreadPosts({
      postId,
      authorId,
      channelId,
    });
  }, []);

  return useQuery({
    queryKey: [
      ['thread', postId, authorId],
      useKeyFromQueryDeps(db.getThreadPosts),
    ],
    queryFn: () => db.getThreadPosts({ parentId: postId }),
  });
};
