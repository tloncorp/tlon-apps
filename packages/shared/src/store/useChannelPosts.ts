import {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { useLiveRef, useOptimizedQueryResults } from '../logic/utilHooks';
import { queryClient } from './reactQuery';
import * as sync from './sync';

const postsLogger = createDevLogger('useChannelPosts', false);

type UseChannelPostsPageParams = db.GetChannelPostsOptions;
type PostQueryData = InfiniteData<db.Post[], unknown>;
type PostQuery = UseInfiniteQueryResult<PostQueryData, Error>;
type SubscriptionPost = [db.Post, string | undefined];

type UseChanelPostsParams = UseChannelPostsPageParams & {
  enabled: boolean;
  firstPageCount?: number;
};

export const clearChannelPostsQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['channelPosts'] });
};

export const useChannelPosts = (options: UseChanelPostsParams) => {
  const mountTime = useMemo(() => {
    return Date.now();
  }, []);

  const { enabled, firstPageCount, ...pageParam } = options;

  const queryKey = useMemo(
    () => [['channelPosts', options.channelId, options.cursor, mountTime]],
    [options.channelId, options.cursor, mountTime]
  );

  const query = useInfiniteQuery({
    enabled,
    initialPageParam: {
      ...pageParam,
      count: firstPageCount,
    } as UseChannelPostsPageParams,
    refetchOnMount: false,
    queryFn: async (ctx): Promise<db.Post[]> => {
      const queryOptions = ctx.pageParam || options;
      postsLogger.log('loading posts', queryOptions);
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
    queryKey,
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
      _firstPageParam
    ): UseChannelPostsPageParams | undefined => {
      const firstPageIsEmpty = !firstPage[0]?.id;
      if (firstPageIsEmpty) {
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

  useAddNewPostsToQuery(queryKey, query);

  const isLoading =
    query.isPending ||
    query.isPaused ||
    query.isFetchingNextPage ||
    query.isFetchingPreviousPage;

  const { loadOlder, loadNewer } = useLoadActionsWithPendingHandlers(query);

  return useMemo(
    () => ({ posts, query, loadOlder, loadNewer, isLoading }),
    [posts, query, loadOlder, loadNewer, isLoading]
  );
};

/**
 * Creates loadNewer/loadOlder handlers that will queue up requests if called
 * while a query is ongoing
 */
function useLoadActionsWithPendingHandlers(
  query: UseInfiniteQueryResult<PostQueryData, Error>
) {
  const queryRef = useLiveRef(query);
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

  return { loadNewer, loadOlder };
}

// New post listener:
//
// Used to proxy events from post subscription to the hook,
// allowing us to manually add new posts to the query data.

type SubscriptionPostListener = (...args: SubscriptionPost) => void;

const subscriptionPostListeners: SubscriptionPostListener[] = [];

const useSubscriptionPostListener = (listener: SubscriptionPostListener) => {
  useEffect(() => {
    subscriptionPostListeners.push(listener);
    return () => {
      const index = subscriptionPostListeners.indexOf(listener);
      if (index !== -1) {
        subscriptionPostListeners.splice(index, 1);
      }
    };
  }, [listener]);
};

/**
 * External interface for transmitting new post events to listener
 */
export const addToChannelPosts = (...args: SubscriptionPost) => {
  subscriptionPostListeners.forEach((listener) => listener(...args));
};

/**
 * Attaches to new post listener to actually update query data when the listener
 * triggers.
 */
function useAddNewPostsToQuery(queryKey: QueryKey, query: PostQuery) {
  const queryRef = useLiveRef(query);
  const subscriptionPostsRef = useRef<SubscriptionPost[]>([]);

  const updateQuery = useCallback(() => {
    // Bail out if we don't have the data yet or if we're fetching, since updating in either of those cases can
    if (
      !queryRef.current.data ||
      queryRef.current.isFetching ||
      !subscriptionPostsRef.current.length
    ) {
      return;
    }
    const remainingPosts = addSubscriptionPostsToQuery(
      queryKey,
      subscriptionPostsRef.current
    );
    subscriptionPostsRef.current = remainingPosts;
  }, [queryKey, queryRef]);

  // When we get a new post from the listener, add it to the pending list
  // and attempt to update query data.
  const handleNewPost = useCallback(
    (...subscriptionPost: SubscriptionPost) => {
      subscriptionPostsRef.current.push(subscriptionPost);
      updateQuery();
    },
    [updateQuery]
  );
  useSubscriptionPostListener(handleNewPost);

  // Attempt to re-apply pending posts whenever the query finishes fetching.
  useEffect(() => {
    updateQuery();
  }, [query.isFetching, updateQuery]);
}

function addSubscriptionPostsToQuery(
  queryKey: QueryKey,
  subscriptionPosts: SubscriptionPost[]
): SubscriptionPost[] {
  const skippedPosts: SubscriptionPost[] = [];

  queryClient.setQueryData(queryKey, (oldData: PostQueryData) => {
    const result = subscriptionPosts.reduce((workingData, subscriptionPost) => {
      const [wasAdded, updatedData] = addSubscriptionPostToQueryData(
        subscriptionPost,
        workingData
      );
      if (!wasAdded) {
        skippedPosts.push(subscriptionPost);
      }
      return updatedData;
    }, oldData);
    return result;
  });

  return skippedPosts;
}

/**
 * Attempts to update query data with each pending post in sequence.
 */
function addSubscriptionPostToQueryData(
  [newPost, previousPostId]: SubscriptionPost,
  data: PostQueryData
): [boolean, PostQueryData] {
  let subscriptionPost = false;
  const result = mapInfiniteData(data, (post: db.Post) => {
    // Check if there's a pending post to replace
    if (post.sentAt === newPost.sentAt) {
      subscriptionPost = true;
      return [
        {
          ...post,
          ...newPost,
        },
      ];
    } else if (post.id === previousPostId) {
      subscriptionPost = true;
      return [newPost, post];
    } else if (post.id === newPost.id) {
      subscriptionPost = true;
      return [{ ...post, ...newPost }];
    } else {
      return [post];
    }
  });
  return [subscriptionPost, result];
}

function mapInfiniteData<
  TItem,
  TInfiniteData extends InfiniteData<TItem[], any>,
>(data: TInfiniteData, cb: (item: TItem) => TItem | TItem[]): TInfiniteData {
  const nextPages = data?.pages?.map((p) => p.flatMap(cb));
  return { ...data, pages: nextPages };
}
