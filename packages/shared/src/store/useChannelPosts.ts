import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const postsLogger = createDevLogger('useChannelPosts', true);

export const useChannelPosts = (options: db.GetChannelPostsOptions) => {
  useEffect(() => {
    postsLogger.log('mount', options);
    return () => {
      postsLogger.log('unmount', options);
    };
  }, []);
  const initialPageParam = useMemo(() => ({ ...options }), []);
  return useInfiniteQuery({
    // TODO: why doesn't initialPageParam work?
    initialPageParam,
    queryFn: async (ctx): Promise<db.PostWithRelations[]> => {
      const queryOptions = ctx.pageParam || options;
      postsLogger.log(
        'start',
        queryOptions.channelId,
        queryOptions.cursor,
        queryOptions.direction,
        queryOptions.date,
        queryOptions.count
      );
      const cached = await db.getChannelPosts(queryOptions);
      if (cached?.length) {
        postsLogger.log('returning', cached.length, 'posts from db');
        return cached;
      }
      postsLogger.log('no posts found in database, loading from api...');
      const res = await sync.syncPosts(queryOptions);
      postsLogger.log('loaded', res.posts?.length, 'posts from api');
      const secondResult = await db.getChannelPosts(queryOptions);
      postsLogger.log(
        'returning',
        secondResult?.length,
        'posts from db after syncing from api'
      );
      return secondResult ?? [];
    },
    queryKey: [
      ['channel', initialPageParam.channelId],
      useKeyFromQueryDeps(db.getChannelPosts),
      [
        initialPageParam.cursor,
        initialPageParam.date,
        initialPageParam.direction,
        initialPageParam.count,
      ],
    ],
    getNextPageParam: (lastPage): db.GetChannelPostsOptions | undefined => {
      if (!lastPage[lastPage.length - 1]?.id) return undefined;
      return {
        ...options,
        direction: 'older',
        cursor: lastPage[lastPage.length - 1]?.id,
        date: undefined,
      };
    },
    getPreviousPageParam: (
      firstPage
    ): db.GetChannelPostsOptions | undefined => {
      if (!firstPage[0]?.id) return undefined;
      return {
        ...options,
        direction: 'newer',
        cursor: firstPage[0]?.id,
        date: undefined,
      };
    },
  });
};
