import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const postsLogger = createDevLogger('useChannelPosts', false);

type UseChanelPostsParams = db.GetChannelPostsOptions;

export const useChannelPosts = (
  options: UseChanelPostsParams & { enabled: boolean }
) => {
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

  const query = useInfiniteQuery({
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
    queryKey: [
      ['channelPosts', options.channelId, mountTime],
      useKeyFromQueryDeps(db.getChannelPosts, options),
    ],
    getNextPageParam: (
      lastPage,
      _allPages,
      lastPageParam
    ): UseChanelPostsParams | undefined => {
      const lastPageIsEmpty = !lastPage[lastPage.length - 1]?.id;
      if (lastPageIsEmpty) {
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
      _allPages,
      firstPageParam
    ): UseChanelPostsParams | undefined => {
      const firstPageIsEmpty = !firstPage[0]?.id;
      if (firstPageParam.mode === 'newest' || firstPageIsEmpty) {
        return undefined;
      }
      return {
        ...options,
        mode: 'newer',
        cursor: firstPage[0]?.id,
      };
    },
  });

  const posts = useMemo<db.Post[] | null>(
    () => query.data?.pages.flatMap((p) => p) ?? null,
    [query.data]
  );

  const loadOlder = useCallback(() => {
    if (!query.isPaused && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query]);

  const loadNewer = useCallback(() => {
    if (
      !query.isPaused &&
      query.hasPreviousPage &&
      !query.isFetchingPreviousPage
    ) {
      query.fetchPreviousPage();
    }
  }, [query]);

  const isLoading =
    query.isPending ||
    query.isPaused ||
    query.isFetchingNextPage ||
    query.isFetchingPreviousPage;

  return useMemo(
    () => ({ posts, query, loadOlder, loadNewer, isLoading }),
    [posts, query, loadOlder, loadNewer, isLoading]
  );
};
