import {
  InfiniteData,
  UseInfiniteQueryResult,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { getChannelIdType } from '@tloncorp/api';
import * as ub from '@tloncorp/api/urbit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as db from '../../db';
import { createDevLogger } from '../../debug';
import { AnalyticsEvent } from '../../domain';
import { useLiveRef, useOptimizedQueryResults } from '../../logic/utilHooks';
import { usePendingPostsInChannel } from '../dbHooks';
import { useCurrentSession } from '../session';
import * as sync from '../sync';
import { SyncPriority } from '../syncQueue';
import { useDetectSequenceRegression } from '../useDetectSequenceRegression';
import { mergePendingPosts } from '../useMergePendingPosts';
import {
  getLatestChannelPostsInitialPage,
  getOlderPageParam,
  queryKeyPrefix,
} from './queries';
import { normalizeCursor } from './normalizeCursor';
import { CursorNormalizationError } from './cursorError';
import { refreshStaleChannelPosts } from './refresh';
import { useDeletedPosts, useNewPostListener } from './subscriptions';

const postsLogger = createDevLogger('useChannelPosts', false);

type PostQueryPage = {
  posts: db.Post[];
  /** Completion time for this page, independent of later pagination. */
  fetchedAt: number;
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

type UseChannelPostsParams = UseChannelPostsPageParams & {
  enabled: boolean;
  firstPageCount?: number;
  filterDeleted?: boolean;
};

export const useChannelPosts = (options: UseChannelPostsParams) => {
  const mountTime = useMemo(() => {
    return Date.now();
  }, []);

  const { enabled } = options;

  const queryKeyWithoutMountTime = useMemo(
    () => [
      ...queryKeyPrefix,
      options.channelId,
      options.cursorPostId,
      options.filterDeleted,
    ],
    [options.channelId, options.cursorPostId, options.filterDeleted]
  );

  const queryKey = useMemo(
    () => [...queryKeyWithoutMountTime, mountTime],
    [queryKeyWithoutMountTime, mountTime]
  );

  const initialPageParam = useMemo(() => {
    return {
      count: options.firstPageCount,
      channelId: options.channelId,
      cursorPostId: options.cursorPostId,
      mode: options.mode ?? 'newest',
      filterDeleted: options.filterDeleted ?? false,
    } as UseChannelPostsPageParams;
  }, [
    options.channelId,
    options.cursorPostId,
    options.filterDeleted,
    options.firstPageCount,
    options.mode,
  ]);

  const placeholderData = useMemo(
    () =>
      getLatestChannelPostsInitialPage<PostQueryPage, PageParam>(
        queryKeyWithoutMountTime,
        initialPageParam
      ),
    [initialPageParam, queryKeyWithoutMountTime]
  );

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
    placeholderData,
    refetchOnMount: false,
    retry(failureCount, error) {
      const shouldRetry = failureCount <= maxFailureCount;
      if (error instanceof CursorNormalizationError) {
        // A retry burst is one failed load. Preserve its exception and the
        // final attempt's diagnostics without reporting every retry as a bug.
        if (!shouldRetry) {
          postsLogger.trackError('failed to load posts', {
            error,
            ...error.diagnostics,
            channelType: getChannelIdType(error.channelId),
            retryCount: failureCount,
          });
        }
      } else {
        postsLogger.trackError('failed to load posts', error);
      }
      return shouldRetry;
    },
    retryDelay: () => 500,
    queryFn: async (ctx): Promise<PostQueryPage> => {
      const queryOptions = await normalizeCursor(
        (ctx.pageParam as UseChannelPostsPageParams | undefined) ??
          initialPageParam
      );

      const posts = await getLocalFirstPosts(queryOptions);
      const canFetchNewerPosts = await hasNewerPosts(
        queryOptions.channelId,
        posts
      );

      return {
        posts,
        fetchedAt: Date.now(),
        canFetchNewerPosts,
      };
    },
    queryKey,
    getNextPageParam: (
      lastPage,
      _allPages,
      _lastPageParam
    ): UseChannelPostsPageParams | undefined => {
      return getOlderPageParam(lastPage.posts, options);
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

      // can't fetch newer if we have no posts to cursor from
      const newestPost = firstPage.posts[0];
      if (!newestPost?.sequenceNum) {
        return undefined;
      }

      return {
        channelId: options.channelId,
        count: options.count ?? 50,
        mode: 'newer',
        cursorSequenceNum: newestPost.sequenceNum,
      };
    },
  });

  // When we get a new post from the listener, add it to the pending list
  // and attempt to update query data.
  const [newPosts, setNewPosts] = useState<db.Post[]>([]);
  const handleNewPost = useCallback(
    (post: db.Post) => {
      if (post.channelId === options.channelId && post.type !== 'reply') {
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

  // Track whether we've ever been at the newest position for this channel.
  // Prevents hasNewest from regressing to false due to sequence gaps from
  // race conditions, which would cause mergePendingPosts to clip newPosts.
  const wasAtNewestRef = useRef(false);
  if (!query.hasPreviousPage) {
    wasAtNewestRef.current = true;
  }
  useEffect(() => {
    wasAtNewestRef.current = false;
  }, [options.channelId]);

  const hasNewest =
    !query.hasPreviousPage || (wasAtNewestRef.current && newPosts.length > 0);

  const rawPosts = useMemo<db.Post[] | null>(() => {
    const queryPosts = query.data?.pages.flatMap((p) => p.posts) ?? [];
    return mergePendingPosts({
      newPosts,
      pendingPosts,
      existingPosts: queryPosts,
      deletedPosts,
      filterDeleted: options.filterDeleted,
      hasNewest,
    });
  }, [
    query.data?.pages,
    hasNewest,
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
      (query.isError && query.failureCount <= maxFailureCount));

  const { loadOlder, loadNewer } = useLoadActionsWithPendingHandlers(query);

  useTrackReady(posts, query, options.channelId);
  useDetectSequenceRegression(
    posts,
    options.channelId,
    options.mode,
    options.cursorPostId
  );

  return useMemo(
    () => ({ posts, query, loadOlder, loadNewer, isLoading }),
    [posts, query, loadOlder, loadNewer, isLoading]
  );
};

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
export async function hasNewerPosts(channelId: string, posts: db.Post[]) {
  // Third-party channels (e.g. %notes) are served by their backing agent, not
  // %channels: `getChannelPosts` short-circuits them with
  // `newestSequenceNum: null`, and their posts live outside `$posts`, so
  // `last_post_sequence_num` is never written. There is nothing to page
  // toward, and without this the invariant below fires on every notebook open.
  if (ub.isThirdPartyChannel(channelId)) {
    return false;
  }

  let latestSequenceNum = await db.getLatestChannelSequenceNum({
    channelId,
  });

  // Channel rows are created without a watermark; only a posts scry that
  // returns a head (or a sequenced insert) sets it, so ask for the head before
  // calling it an invariant violation. A failed sync must not fail the page.
  if (latestSequenceNum === null) {
    const repair = sync
      .syncPosts(
        { channelId, mode: 'newest', count: 1 },
        { priority: SyncPriority.High }
      )
      .catch((e) => postsLogger.log('hasNewerPosts: watermark sync failed', e));
    if (posts.length > 0) {
      // Seed the watermark in the background: awaiting it would hold these
      // local posts behind a scry that can take 60 s offline. Returning true
      // lets the next page fetch see the seeded value.
      return true;
    }
    // getLocalFirstPosts already ran a remote sync that could have seeded it,
    // so this is a second attempt before reporting.
    await repair;
    latestSequenceNum = await db.getLatestChannelSequenceNum({ channelId });
  }

  // Even for empty channels, we should have a value here. If somehow we don't,
  // assume there's more to load and assume the next load will rectify sequence state.
  if (latestSequenceNum === null) {
    // `getLatestChannelSequenceNum` returns null both when the channel row is
    // missing and when the row's sequence number is unset, so say which. Only
    // on this invariant-violation path, so the extra read is not in the hot
    // path.
    const channel = await db.getChannel({ id: channelId });
    postsLogger.trackError(
      'invariant violation: channel missing latest sequence number',
      { channelId, hasChannelRow: !!channel, localPostCount: posts.length }
    );
    return true;
  }

  // corner case: empty channel, nothing to load
  if (latestSequenceNum === 0) {
    return false;
  }

  const largestSeq = posts?.[0]?.sequenceNum;
  if (!largestSeq) {
    return true;
  }

  return largestSeq < latestSequenceNum;
}

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
  const hasResolvedCurrentQuery = query.isSuccess && !query.isPlaceholderData;

  useEffect(() => {
    if (
      !alreadyTracked &&
      hasResolvedCurrentQuery &&
      (hasEnoughPosts || (!isLoading && !canLoadMore))
    ) {
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
    hasResolvedCurrentQuery,
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
    refreshStaleChannelPosts({
      channelId,
      posts,
      session,
      pendingPostIds: pendingStalePosts.current,
      refreshPosts: sync.syncUpdatedPosts,
      onError: (error) =>
        postsLogger.trackError(
          'failed to refresh stale posts',
          error instanceof Error ? error : { error }
        ),
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
