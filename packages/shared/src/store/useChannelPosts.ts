import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';

const postsLogger = createDevLogger('useChannelPosts', true);

type UseChanelPostsParams = db.GetChannelPostsOptions;

export const useChannelPosts = (
  options: UseChanelPostsParams & { enabled: boolean }
) => {
  const key = useMemo(() => {
    return Math.random().toString(36).substring(7);
  }, []);

  useEffect(() => {
    postsLogger.log('mount', options);
    return () => {
      postsLogger.log('unmount', options);
    };
  }, []);

  useEffect(() => {
    postsLogger.log('options', options);
  }, [options]);

  const mountTime = useMemo(() => {
    return Date.now();
  }, []);

  const { enabled, ...pageParam } = options;

  return useInfiniteQuery({
    enabled,
    initialPageParam: pageParam,
    refetchOnMount: false,
    queryFn: async (ctx): Promise<db.Post[]> => {
      const queryOptions = ctx.pageParam || options;
      postsLogger.log(
        'loading posts',
        queryOptions.channelId,
        queryOptions.cursor,
        queryOptions.mode,
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
    queryKey: [['channels', options.channelId, key], mountTime],
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
        if (lastPageParam?.mode === 'newer') {
          return {
            ...options,
            mode: 'older',
            cursor: lastPageParam.cursor,
          };
        } else {
          return undefined;
        }
      }
      return {
        ...options,
        mode: 'older',
        cursor: lastPage[lastPage.length - 1]?.id,
      };
    },
    getPreviousPageParam: (
      firstPage,
      _allPages
    ): UseChanelPostsParams | undefined => {
      const reachedEnd = !firstPage[0]?.id;
      if (reachedEnd) {
        return undefined;
      }
      return {
        ...options,
        mode: 'newer',
        cursor: firstPage[0]?.id,
      };
    },
  });
};
