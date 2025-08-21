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
import { useLiveRef, useOptimizedQueryResults } from '../logic/utilHooks';
import { usePendingPostsInChannel } from './dbHooks';
import { queryClient } from './reactQuery';
import { useCurrentSession } from './session';
import * as sync from './sync';
import { SyncPriority } from './syncQueue';
import { mergePendingPosts } from './useMergePendingPosts';

const postsLogger = createDevLogger('useChannelPosts', true);

type PostQueryPage = {
  posts: db.Post[];
  /**
   * False when a sync page reports that there are no more newer posts.
   * Obviously, new posts can be made after this is set: in practice, we
   * should have switched over to a subscription by then.
   */
  canFetchNewerPosts: boolean;
};
type UseChannelPostsPageParams = db.GetSequencedPostsOptions & {
  cursorPostId?: string | null;
};
type PageParam = UseChannelPostsPageParams;
type PostQueryData = InfiniteData<PostQueryPage, unknown>;
type SubscriptionPost = [db.Post, string | undefined];

type UseChannelPostsParams = UseChannelPostsPageParams & {
  enabled: boolean;
  firstPageCount?: number;
  hasCachedNewest?: boolean;
  filterDeleted?: boolean;
};

export const clearChannelPostsQueries = () => {
  queryClient.invalidateQueries({ queryKey: ['channelPosts'] });
};

/*
  We want to operate on sequence numbers, but our unread markers are keyed by postId.
  This encapsulate the logic for obtaining a sequence based cursor.
*/
async function normalizeCursor(options: PageParam): Promise<PageParam> {
  // only attempt to transform if we have a postId shaped cursor
  if (!options.cursorPostId) {
    return options;
  }

  // first check locally to see if we already have the post
  const cursorPost = await db.getPost({
    postId: options.cursorPostId,
  });
  if (cursorPost && cursorPost.sequenceNum) {
    return {
      ...options,
      cursorPostId: null,
      cursorSequenceNum: cursorPost.sequenceNum,
    };
  }

  // if not, grab it from the API. Proactively snag surrounding posts while we're there
  await sync.syncPosts(
    {
      channelId: options.channelId,
      cursor: options.cursorPostId,
      mode: 'around',
      count: options.count,
    },
    { priority: SyncPriority.High }
  );

  const syncedCursorPost = await db.getPost({
    postId: options.cursorPostId,
  });

  if (syncedCursorPost && syncedCursorPost.sequenceNum) {
    return {
      ...options,
      cursorPostId: null,
      cursorSequenceNum: syncedCursorPost.sequenceNum,
    };
  }

  // should always have it after fetching, if we don't it's an error
  throw new Error('Failed to normalize cursor');
}

async function getLocalFirstPosts(options: UseChannelPostsPageParams) {
  postsLogger.log(`localFirstPosts: running`, options);
  const posts = await db.getSequencedChannelPosts(options);

  // if we find local results, return them immediately
  if (posts.length) {
    postsLogger.log(`localFirstPosts: found local posts`, posts);
    return posts;
  }

  postsLogger.log(`localFirstPosts: no local posts found, syncing from API...`);
  // if we don't, sync the posts from the API...
  if (options.mode === 'newest') {
    await sync.syncPosts(
      { channelId: options.channelId, mode: 'newest', count: 50 },
      { priority: SyncPriority.High }
    );
  } else {
    if (!options.cursorSequenceNum) {
      throw new Error(
        `invariant violation: cannot fetch sequenced posts from API without sequence number`
      );
    }
    await sync.syncSequencedPosts(
      {
        channelId: options.channelId,
        cursorSequenceNum: options.cursorSequenceNum,
        mode: options.mode,
        count: options.count ?? 50,
      },
      { priority: SyncPriority.High }
    );
  }
  postsLogger.log(`localFirstPosts: synced remote posts`);

  const syncedPosts = await db.getSequencedChannelPosts(options);

  postsLogger.log(`localFirstPosts: found synced posts`, syncedPosts);
  return syncedPosts;
}

/*
 * For use in the paginated infinite query. We keep track of the latest
 * sequence number for every channel and use that as our primary cue for
 * when to stop loading more posts. It's paramount to keep that up
 * to date and do so quickly whenever the app opens.
 *
 * Note: once we're already at the beginning, new posts (sent by us or heard
 * over the sub) make their way into the result set via our post listeners.
 * These run outside the context of the infinite query.
 */
async function hasNewerPosts(channelId: string, posts: db.Post[]) {
  const latestSequenceNum = await db.getLatestChannelSequenceNum({
    channelId,
  });

  // Even for empty channels, we should have a value here. If somehow we don't,
  // assume there's more to load and assume the next load will rectify sequence state.
  if (latestSequenceNum === null) {
    postsLogger.trackError(
      'invariant violation: channel missing latest sequence number'
    );
    return true;
  }

  // corner case: empty channel, nothing to load
  if (latestSequenceNum === 0) {
    return false;
  }

  const largestSeq = posts?.[0].sequenceNum;
  if (!largestSeq) {
    return true;
  }

  return largestSeq < latestSequenceNum;
}

export const useChannelPosts = (options: UseChannelPostsParams) => {
  const mountTime = useMemo(() => {
    return Date.now();
  }, []);

  const { enabled, firstPageCount, ...pageParam } = options;

  const queryKey = useMemo(
    () => [
      [
        'channelPosts',
        options.channelId,
        options.cursorPostId,
        options.filterDeleted,
        options.hasCachedNewest,
        mountTime,
      ],
    ],
    [
      options.channelId,
      options.cursorPostId,
      options.filterDeleted,
      options.hasCachedNewest,
      mountTime,
    ]
  );

  const initialPageParam = useMemo(() => {
    return {
      count: options.firstPageCount,
      channelId: options.channelId,
      cursorPostId: options.cursorPostId,
      mode: options.mode ?? 'newest',
      filterDeleted: options.filterDeleted ?? false,
      hasCachedNewest: options.hasCachedNewest ?? false,
    } as UseChannelPostsPageParams;
  }, [options]);

  const abortControllerRef = useRef<AbortController | null>(
    new AbortController()
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
    };
  }, [queryKey]);

  const maxFailureCount = 3;

  const query = useInfiniteQuery({
    enabled,
    initialPageParam,
    refetchOnMount: false,
    retry(failureCount, error) {
      postsLogger.trackError('failed to load posts', {
        errorMessage: error.message,
        errorStack: error.stack,
      });
      if (failureCount > maxFailureCount) {
        return false;
      }
      return true;
    },
    retryDelay: () => 500,
    queryFn: async (ctx): Promise<PostQueryPage> => {
      const queryOptions = await normalizeCursor(
        ctx.pageParam || initialPageParam
      );

      const posts = await getLocalFirstPosts(queryOptions);
      const canFetchNewerPosts = await hasNewerPosts(
        queryOptions.channelId,
        posts
      );

      return {
        posts,
        canFetchNewerPosts,
      };
    },
    queryKey,
    getNextPageParam: (
      lastPage,
      _allPages,
      _lastPageParam
    ): UseChannelPostsPageParams | undefined => {
      const oldestPost = lastPage.posts.at(-1);
      const lastPageIsEmpty = !oldestPost?.id;

      // corner case: if somehow we don't have any posts, we can't load more
      if (lastPageIsEmpty) {
        return undefined;
      }

      // main check: if we're at the beginning of the sequence, we're done
      if (oldestPost && oldestPost.sequenceNum === 1) {
        return undefined;
      }

      return {
        channelId: options.channelId,
        count: options.count ?? 50,
        mode: 'older',
        cursorSequenceNum: oldestPost.sequenceNum!,
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
      // TODO: ^ verify?
      const hasReachedNewest = allPages.some((p) => !p.canFetchNewerPosts);

      if (hasReachedNewest) {
        return undefined;
      }

      return {
        channelId: options.channelId,
        count: options.count ?? 50,
        mode: 'newer',
        cursorSequenceNum: firstPage.posts[0].sequenceNum!,
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

  useEffect(() => {
    setNewPosts([]);
  }, [options.channelId]);

  const pendingPosts = usePendingPostsInChannel(options.channelId);
  const deletedPosts = useDeletedPosts(options.channelId);

  const rawPosts = useMemo<db.Post[] | null>(() => {
    const queryPosts = query.data?.pages.flatMap((p) => p.posts) ?? [];
    return mergePendingPosts({
      newPosts,
      pendingPosts,
      existingPosts: queryPosts,
      deletedPosts,
      filterDeleted: options.filterDeleted,
      hasNewest: !query.hasPreviousPage,
    });
  }, [
    query.data?.pages,
    query.hasPreviousPage,
    newPosts,
    pendingPosts,
    deletedPosts,
    options.filterDeleted,
  ]);

  const posts = useOptimizedQueryResults(rawPosts);

  useRefreshPosts(options.channelId, posts);

  const isLoading =
    enabled &&
    (query.isPending ||
      query.isPaused ||
      query.isFetchingNextPage ||
      query.isFetchingPreviousPage ||
      (query.isError && query.failureCount < maxFailureCount));

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
  let nextPosts: db.Post[] = [post, ...newPosts];
  const pendingPostIndex = newPosts.findIndex(
    (p) =>
      (p.deliveryStatus === 'pending' || p.deliveryStatus === 'enqueued') &&
      p.sentAt === post.sentAt
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

  // newest posts should be at the start of the array
  const finalPosts = nextPosts.sort((a, b) => {
    const isUnconfirmed = (p: db.Post) =>
      p.deliveryStatus === 'pending' ||
      p.deliveryStatus === 'enqueued' ||
      p.deliveryStatus === 'failed';

    // reminder to self: negative value means a comes before (i.e. is newer than) b
    switch (true) {
      case isUnconfirmed(a) && isUnconfirmed(b):
        return b.sentAt - a.sentAt;

      case isUnconfirmed(a) && !isUnconfirmed(b):
        // always show unconfirmed before confirmed
        return -1;

      case !isUnconfirmed(a) && isUnconfirmed(b):
        // always show confirmed after unconfirmed
        return 1;

      case !isUnconfirmed(a) && !isUnconfirmed(b):
        return b.receivedAt - a.receivedAt;

      default:
        throw new Error('Unexpected switch case');
    }
  });
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
          session &&
          (post.syncedAt == null ||
            post.syncedAt < (session?.startTime ?? 0)) &&
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
