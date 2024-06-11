import { replaceEqualDeep, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as sync from './sync';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

const postsLogger = createDevLogger('useChannelPosts', false);

type UseChannelPostsPageParams = db.GetChannelPostsOptions;
type UseChanelPostsParams = UseChannelPostsPageParams & {
  enabled: boolean;
  firstPageCount?: number;
};

export const useChannelPosts = (options: UseChanelPostsParams) => {
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

  const { enabled, firstPageCount, ...pageParam } = options;

  const query = useInfiniteQuery({
    enabled,
    initialPageParam: {
      ...pageParam,
      count: firstPageCount,
    } as UseChannelPostsPageParams,
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
    ): UseChannelPostsPageParams | undefined => {
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
    ): UseChannelPostsPageParams | undefined => {
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

  useEffect(() => {
    if (query.error) {
      console.error('useChannelPosts error:', query.error);
    }
  }, [query.error]);

  const rawPosts = useMemo<db.Post[] | null>(
    () => query.data?.pages.flatMap((p) => p) ?? null,
    [query.data]
  );
  const posts = useOptimizedQueryResults(rawPosts);

  // Using a ref here looks kind of stupid, but short circuits a bunch of
  // renders. Maybe there's a better way?
  const queryRef = useRef(query);
  queryRef.current = query;

  const olderPageLoadingPendingRef = useRef(false);
  const newerPageLoadingPendingRef = useRef(false);

  const loadOlder = useCallback(() => {
    if (!queryRef.current.isFetching) {
      queryRef.current.fetchNextPage();
    } else {
      olderPageLoadingPendingRef.current = true;
    }
  }, []);

  const loadNewer = useCallback(() => {
    if (!queryRef.current.isFetching) {
      queryRef.current.fetchPreviousPage();
    } else {
      newerPageLoadingPendingRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (
      !query.isFetching &&
      (olderPageLoadingPendingRef.current || newerPageLoadingPendingRef.current)
    ) {
      if (olderPageLoadingPendingRef.current) {
        olderPageLoadingPendingRef.current = false;
        loadOlder();
      } else {
        newerPageLoadingPendingRef.current = false;
        loadNewer();
      }
    }
  }, [query.isFetching, loadOlder, loadNewer]);

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

/**
 * Minimizes churn for queries that return similar results repeatedly. Uses
 * react-query's `replaceEqualDeep` to ensure that we only return new objects
 * when the data belonging to those objects has changed.
 */
function useOptimizedQueryResults<T extends { id: string }>(
  value: T[] | null | undefined
) {
  const lastValueRef = useRef(value);
  return useMemo(() => {
    const lastPostsMap: Record<string, T> =
      lastValueRef.current?.reduce<Record<string, T>>((memo, p) => {
        memo[p.id] = p;
        return memo;
      }, {}) ?? {};
    lastValueRef.current = value;
    return (
      value?.map((p) =>
        lastPostsMap[p.id] ? replaceEqualDeep(lastPostsMap[p.id], p) : p
      ) ?? null
    );
  }, [value]);
}
