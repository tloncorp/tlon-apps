import { useQuery } from '@tanstack/react-query';

import * as db from '../db';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

export const useThreadPosts = ({
  postId,
  authorId,
}: {
  postId: string;
  authorId: string;
}) => {
  return useQuery({
    queryKey: [
      ['thread', postId, authorId],
      useKeyFromQueryDeps(db.getThreadPosts),
    ],
    queryFn: () => db.getThreadPosts({ parentId: postId }),
  });
};
