import {
  InfiniteData,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as db from '../db';
import { createDevLogger } from '../debug';
import {
  useDebouncedValue,
  useLiveRef,
  useOptimizedQueryResults,
} from '../logic/utilHooks';
import { queryClient } from './reactQuery';
import { useCurrentSession } from './session';
import * as sync from './sync';
import { SyncPriority } from './syncQueue';

const postsLogger = createDevLogger('useChannelPosts', false);

type UseChannelPostsPageParams = db.GetChannelPostsOptions;
type PostQueryData = InfiniteData<db.Post[], unknown>;
type SubscriptionPost = [db.Post, string | undefined];

type UseChanelPostsParams = UseChannelPostsPageParams & {
  enabled: boolean;
  firstPageCount?: number;
  hasCachedNewest?: boolean;
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
// We should figure out why this is necessary.
      if (
        queryOptions &&
        queryOptions.mode === 'newest' &&
        !options.hasCachedNewest
      ) {
        await sync.syncPosts(queryOptions, { priority: SyncPriority.High });
      }
      const cached = await db.getChannelPosts(queryOptions);
      if (cached?.length) {
        postsLogger.log('returning', cached.length, 'posts from db');
        return cached;
      }

      postsLogger.log('no posts found in database, loading from api...');
      const res = await sync.syncPosts(
        {
          ...queryOptions,
          count: options.count ?? 50,
        },
        { priority: SyncPriority.High }
      );
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
      firstPageParam
    ): UseChannelPostsPageParams | undefined => {
      const firstPageIsEmpty = !firstPage[0]?.id;
      if (
        firstPageIsEmpty ||
        (firstPageParam?.mode === 'newest' && options.hasCachedNewest)
      ) {
        return undefined;
      }
      return {
        ...options,
        mode: 'newer',
        cursor: firstPage[0]?.id,
      };
    },
  });

  // When we get a new post from the listener, add it to the pending list
  // and attempt to update query data.
  const [newPosts, setNewPosts] = useState<db.Post[]>([]);
  const handleNewPost = useCallback(
    (post: db.Post) => {
      if (post.channelId === options.channelId) {
        setNewPosts((posts) => addPostToNewPosts(post, posts));
      }
    },
    [options.channelId]
  );
  useSubscriptionPostListener(handleNewPost);

  const rawPosts = useMemo<db.Post[] | null>(() => {
    const queryPosts = query.data?.pages.flatMap((p) => p) ?? null;
    if (!newPosts.length || query.hasPreviousPage) {
      return queryPosts;
    }
    const newestQueryPostId = queryPosts?.[0]?.id;
    const newerPosts = newPosts.filter(
      (p) => !newestQueryPostId || p.id > newestQueryPostId
    );
    return newestQueryPostId ? [...newerPosts, ...queryPosts] : newPosts;
  }, [query.data, query.hasPreviousPage, newPosts]);

  const posts = useOptimizedQueryResults(rawPosts);

  useRefreshPosts(options.channelId, posts);

  const isLoading = useDebouncedValue(
    enabled &&
      (query.isPending ||
        query.isPaused ||
        query.isFetchingNextPage ||
        query.isFetchingPreviousPage),
    100
  );

  const { loadOlder, loadNewer } = useLoadActionsWithPendingHandlers(query);

  return useMemo(
    () => ({ posts, query, loadOlder, loadNewer, isLoading }),
    [posts, query, loadOlder, loadNewer, isLoading]
  );
};

/**
 * Insert a post into our working posts array, merging + resorting if necessary.
 */
function addPostToNewPosts(post: db.Post, newPosts: db.Post[]) {
  postsLogger.log('new posts');
  let nextPosts: db.Post[] | null = null;
  const pendingPostIndex = newPosts?.findIndex(
    (p) => p.deliveryStatus === 'pending' && p.sentAt === post.sentAt
  );
  if (pendingPostIndex !== -1) {
    nextPosts = [
      ...newPosts.slice(0, pendingPostIndex),
      post,
      ...newPosts.slice(pendingPostIndex + 1),
    ];
  } else {
    const existingPostIndex = newPosts?.findIndex((p) => p.id === post.id);
    if (existingPostIndex !== -1) {
      nextPosts = [
        ...newPosts.slice(0, existingPostIndex),
        post,
        ...newPosts.slice(existingPostIndex + 1),
      ];
    }
  }

  postsLogger.log('processsed pending existing');

  const finalPosts = (nextPosts ? nextPosts : [post, ...newPosts]).sort(
    (a, b) => b.receivedAt - a.receivedAt
  );
  postsLogger.log('calculated final');
  return finalPosts;
}

/**
 * Watches for new posts that are older than the current session and reloads them if necessary.
 */
function useRefreshPosts(channelId: string, posts: db.Post[] | null) {
  const session = useCurrentSession();

  const pendingStalePosts = useRef(new Set());
  useEffect(() => {
    posts?.forEach((post) => {
      if (
        session &&
        post.syncedAt < (session?.startTime ?? 0) &&
        !pendingStalePosts.current.has(post.id)
      ) {
        sync.syncThreadPosts(
          {
            postId: post.id,
            channelId,
            authorId: post.authorId,
          },
          { priority: 4 }
        );
        pendingStalePosts.current.add(post.id);
      }
    });
  }, [channelId, posts, session]);
}

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
