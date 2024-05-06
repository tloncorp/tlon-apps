import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const postsLogger = createDevLogger('useChannelPosts', true);

type UseChanelPostsParams = db.GetChannelPostsOptions & {
  anchorToNewest?: boolean;
};

export const useChannelPosts = (options: UseChanelPostsParams) => {
  useEffect(() => {
    postsLogger.log('mount', options);
    return () => {
      postsLogger.log('unmount', options);
    };
  }, []);
  return useInfiniteQuery({
    initialPageParam: options,
    refetchOnMount: false,
    queryFn: async (ctx): Promise<db.Post[]> => {
      const queryOptions = ctx.pageParam || options;
      postsLogger.log(
        'loading posts',
        queryOptions.channelId,
        queryOptions.cursor,
        queryOptions.direction,
        queryOptions.date ? queryOptions.date.toISOString() : undefined,
        queryOptions.count,
        queryOptions.anchorToNewest
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
      ['channels', options.channelId],
      useKeyFromQueryDeps(db.getChannelPosts),
    ],
    getNextPageParam: (
      lastPage,
      _allPages,
      lastPageParam
    ): UseChanelPostsParams | undefined => {
      const reachedEnd = !lastPage[lastPage.length - 1]?.id;
      if (reachedEnd) {
        // If we've only tried to get newer posts + that's failed, try using the
        // same cursor to get older posts instead. This can happen when the
        // first cached page is empty.
        if (lastPageParam?.direction === 'newer') {
          return {
            ...options,
            direction: 'older',
            cursor: lastPageParam.cursor,
            date: undefined,
          };
        } else {
          return undefined;
        }
      }
      return {
        ...options,
        direction: 'older',
        cursor: lastPage[lastPage.length - 1]?.id,
        date: undefined,
      };
    },
    getPreviousPageParam: (
      firstPage,
      _allPages,
      firstPageParam
    ): UseChanelPostsParams | undefined => {
      const reachedEnd = firstPage[0]?.id;
      const alreadyAtNewest = firstPageParam?.anchorToNewest;
      if (reachedEnd || alreadyAtNewest) return undefined;
      return {
        ...options,
        direction: 'newer',
        cursor: firstPage[0]?.id,
        date: undefined,
      };
    },
  });
};
