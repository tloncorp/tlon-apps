import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';

const postsLogger = createDevLogger('useChannelPosts', false);

export const useChannelPosts = (options: db.GetChannelPostsOptions) => {
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
    queryKey: [['channel', options.channelId]],
    getNextPageParam: (
      lastPage,
      allPages,
      lastPageParam
    ): db.GetChannelPostsOptions | undefined => {
      if (!lastPage[lastPage.length - 1]?.id) {
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
