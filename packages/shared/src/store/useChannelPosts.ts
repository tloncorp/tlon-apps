import {
  InfiniteData,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getChannelIdType } from '../api/apiUtils';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
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

type PostQueryPage = {
  posts: db.Post[];
  /**
   * False when a sync page reports that there are no more newer posts.
   * Obviously, new posts can be made after this is set: in practice, we
   * should have switched over to a subscription by then.
   */
  canFetchNewerPosts: boolean;
};
type UseChannelPostsPageParams = db.GetChannelPostsOptions;
type PostQueryData = InfiniteData<PostQueryPage, unknown>;
type SubscriptionPost = [db.Post, string | undefined];

type UseChannelPostsParams = UseChannelPostsPageParams & {
  enabled: boolean;
  firstPageCount?: number;
  hasCachedNewest?: boolean;
  disableUnconfirmedPosts?: boolean;
  filterDeleted?: boolean;
};

export const clearChannelPostsQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['channelPosts'] });
};

export const useChannelPosts = (options: UseChannelPostsParams) => {
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
    queryFn: async (ctx): Promise<PostQueryPage> => {
      const queryOptions = ctx.pageParam || options;
      postsLogger.log('loading posts', { queryOptions, options });
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
        return { posts: cached, canFetchNewerPosts: true };
      }

      postsLogger.log('no posts found in database, loading from api...');
      const res = await sync.syncPosts(
        {
          ...queryOptions,
          count: options.count ?? 50,
        },
        { priority: SyncPriority.High }
      );
      postsLogger.log('loaded', res.posts?.length, 'posts from api', { res });
      const secondResult = await db.getChannelPosts(queryOptions);
      postsLogger.log(
        'returning',
        secondResult?.length,
        'posts from db after syncing from api'
      );
      return {
        posts: secondResult ?? [],
        canFetchNewerPosts: res.newer != null,
      };
    },
    queryKey,
    getNextPageParam: (
      lastPage,
      _allPages,
      lastPageParam
    ): UseChannelPostsPageParams | undefined => {
      const lastPageIsEmpty = !lastPage.posts.at(-1)?.id;
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
        cursor: lastPage.posts.at(-1)?.id,
      };
    },
    getPreviousPageParam: (
      firstPage,
      allPages,
      _firstPageParam
    ): UseChannelPostsPageParams | undefined => {
      // if any page has reached the newest post, we can't fetch any newer posts
      // page order for allPages should be newest -> oldest
      // but apparently on channels with less than 50 posts, the order is reversed (on web only)
      const hasReachedNewest = allPages.some((p) => !p.canFetchNewerPosts);

      if (hasReachedNewest) {
        return undefined;
      }

      return {
        ...options,
        mode: 'newer',
        cursor: firstPage.posts[0]?.id,
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
  useNewPostListener(handleNewPost);

  // Why store the unconfirmed posts in a separate state?
  // With a live query, we'd see duplicates between the latest post from
  // getUnconfirmedPosts and latest post from the main useChannelPosts query.
  // (This *shouldn't* be the case - we should be deduplicating - but I think
  // there's a timing issue here that is taking too long to debug.)
  const [unconfirmedPosts, setUnconfirmedPosts] = useState<db.Post[] | null>(
    null
  );
  useEffect(() => {
    if (options.disableUnconfirmedPosts) {
      return;
    }
    db.getUnconfirmedPosts({ channelId: options.channelId }).then(
      setUnconfirmedPosts
    );
    setNewPosts([]);
  }, [options.channelId, options.disableUnconfirmedPosts]);
  const rawPosts = useMemo<db.Post[] | null>(() => {
    const rawPostsWithoutUnconfirmeds = (() => {
      const queryPosts = query.data?.pages.flatMap((p) => p.posts) ?? null;
      if (!newPosts.length || query.hasPreviousPage) {
        return queryPosts;
      }
      const newestQueryPostId = queryPosts?.[0]?.id;
      const newerPosts = newPosts.filter(
        (p) => !newestQueryPostId || p.id > newestQueryPostId
      );
      // Deduping is necessary because the query data may not have been updated
      // at this point and we may have already added the post.
      // This is most likely to happen in bad network conditions or when the
      // ship is under heavy load.
      // This seems to be caused by an async issue where clearMatchedPendingPosts
      // is called before the new post is added to the query data.
      // TODO: Figure out why this is happening.
      const dedupedQueryPosts =
        queryPosts?.filter(
          (p) => !newerPosts.some((newer) => newer.sentAt === p.sentAt)
        ) ?? [];
      return newestQueryPostId
        ? [...newerPosts, ...dedupedQueryPosts]
        : newPosts;
    })();

    if (unconfirmedPosts == null) {
      return rawPostsWithoutUnconfirmeds;
    }

    // Then, add "unconfirmed" posts (which we have received through e.g. push
    // notifications but haven't confirmed via sync). Skip if we already have a
    // confirmed version of the post.
    //
    // Why not dedupe these alongside `newPosts`? We hold off on showing
    // `newPosts` until we've fully backfilled the channel
    // (`!query.hasPreviousPage`) - but we want to show unconfirmeds ASAP.
    const out = rawPostsWithoutUnconfirmeds ?? [];
    // bubble-insert unconfirmed posts
    for (const p of unconfirmedPosts ?? []) {
      // skip if we already have this post
      if (out.some((qp) => qp.id === p.id)) {
        continue;
      }

      const insertIdx = out.findIndex((x) => x.sentAt <= p.sentAt);
      if (insertIdx === -1) {
        out.push(p);
      } else {
        out.splice(insertIdx, 0, p);
      }
    }

    return out;
  }, [query.data, query.hasPreviousPage, newPosts, unconfirmedPosts]);

  const deletedPosts = useDeletedPosts(options.channelId);
  const rawPostsWithDeleteFilterApplied = useMemo(() => {
    if (!options.filterDeleted) {
      return rawPosts;
    }
    return rawPosts?.filter((p) => !p.isDeleted && !deletedPosts[p.id]);
  }, [options.filterDeleted, rawPosts, deletedPosts]);

  const posts = useOptimizedQueryResults(rawPostsWithDeleteFilterApplied);

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

  useTrackReady(posts, query, options.channelId);

  return useMemo(
    () => ({ posts, query, loadOlder, loadNewer, isLoading }),
    [posts, query, loadOlder, loadNewer, isLoading]
  );
};

/**
 * Send a posthog event once we either have ~enough posts to fill the screen, or
 * we've loaded all posts.
 */
function useTrackReady(
  posts: db.Post[] | null,
  query: UseInfiniteQueryResult<InfiniteData<PostQueryPage, unknown>, Error>,
  channelId: string
) {
  const startTimeRef = useRef(Date.now());
  const loadTracked = useRef(false);
  const alreadyTracked = loadTracked.current;
  const postsLength = posts?.length ?? 0;
  const hasEnoughPosts = postsLength > 30;
  const isLoading = query.isLoading || query.isPending;
  const canLoadMore = query.hasNextPage || query.hasPreviousPage;

  useEffect(() => {
    if (!alreadyTracked && (hasEnoughPosts || (!isLoading && !canLoadMore))) {
      loadTracked.current = true;
      postsLogger.trackEvent(AnalyticsEvent.ChannelLoadComplete, {
        channelType: getChannelIdType(channelId),
        duration: Date.now() - startTimeRef.current,
      });
    }
  }, [
    alreadyTracked,
    canLoadMore,
    channelId,
    hasEnoughPosts,
    isLoading,
    postsLength,
  ]);
}

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

  const pendingStalePosts = useRef(new Set<string>());
  useEffect(() => {
    const toSync =
      posts?.filter(
        (post) =>
          // consider unconfirmed posts as stale
          (post.syncedAt == null ||
            (session && post.syncedAt < (session?.startTime ?? 0))) &&
          !pendingStalePosts.current.has(post.id)
      ) || [];

    postsLogger.log('stale posts to sync', toSync.length);

    const chunked = [];
    const chunkSize = 50;
    for (let i = 0; i < toSync.length; i += chunkSize) {
      chunked.push(toSync.slice(i, i + chunkSize));
    }

    postsLogger.log('chunked', chunked.length);
    chunked.forEach((chunk, i) => {
      const startCursor = chunk[chunk.length - 1].id;
      const endCursor = chunk[0].id;
      postsLogger.log('syncing chunk', startCursor, 'through', endCursor);
      sync.syncUpdatedPosts(
        {
          channelId,
          startCursor,
          endCursor,
          afterTime: new Date(session?.startTime ?? 0),
        },
        { priority: 4 }
      );
      pendingStalePosts.current = new Set<string>([
        ...chunk.map((p) => p.id),
        ...pendingStalePosts.current,
      ]);
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

const newPostListeners: SubscriptionPostListener[] = [];

const useNewPostListener = (listener: SubscriptionPostListener) => {
  useEffect(() => {
    newPostListeners.push(listener);
    return () => {
      const index = newPostListeners.indexOf(listener);
      if (index !== -1) {
        newPostListeners.splice(index, 1);
      }
    };
  }, [listener]);
};

type DeletedPostListener = (postId: string, isDeleted: boolean) => void;

const deletedPostListeners: DeletedPostListener[] = [];

const useDeletedPostListener = (listener: DeletedPostListener) => {
  useEffect(() => {
    deletedPostListeners.push(listener);
    return () => {
      const index = deletedPostListeners.indexOf(listener);
      if (index !== -1) {
        deletedPostListeners.splice(index, 1);
      }
    };
  }, [listener]);
};

const useDeletedPosts = (channelId: string) => {
  const [deletedPosts, setDeletedPosts] = useState<Record<string, boolean>>({});
  const handleDeletedPost = useCallback(
    (postId: string, isDeleted: boolean) => {
      setDeletedPosts((value) => ({ ...value, [postId]: isDeleted }));
    },
    []
  );
  useDeletedPostListener(handleDeletedPost);
  useEffect(() => {
    setDeletedPosts({});
  }, [channelId]);
  return deletedPosts;
};

/**
 * External interface for transmitting new post events to listener
 */
export const addToChannelPosts = (...args: SubscriptionPost) => {
  newPostListeners.forEach((listener) => listener(...args));
};

export const deleteFromChannelPosts = (post: db.Post) => {
  deletedPostListeners.forEach((listener) => listener(post.id, true));
};

export const rollbackDeletedChannelPost = (post: db.Post) => {
  deletedPostListeners.forEach((listener) => listener(post.id, false));
};
