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
  const posts = await db.getSequencedChannelPosts(options);

  // if we find local results, return them immediately
  if (posts.length) {
    return posts;
  }

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

  const syncedPosts = await db.getSequencedChannelPosts(options);
  if (!syncedPosts.length) {
    console.error('invariant violation: no posts found after syncing');
  }

  return syncedPosts;
}

async function hasNewerPosts(channelId: string, posts: db.Post[]) {
  const latestSequenceNum = await db.getLatestChannelSequenceNum({
    channelId,
  });

  if (latestSequenceNum === null) {
    return true;
  }

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

  useEffect(() => {
    console.log(`bl:qk query key changed`, queryKey);
  }, [queryKey]);

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

  // useEffect(() => {
  //   console.log(`bl:qk initial page param change`, initialPageParam);
  // }, [initialPageParam]);

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
    // initialPageParam: {
    //   channelId: 'chat/~zod/vm72742',
    //   count: 50,
    //   filterDeleted: false,
    //   hasCachedNewest: true,
    //   mode: 'newest',
    // } as UseChannelPostsPageParams,
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
      // function getRandomFourDigitNumber() {
      //   return Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
      // }
      // const queryFnId = getRandomFourDigitNumber();
      // const queryOptions = ctx.pageParam || initialPageParam;

      const queryOptions = await normalizeCursor(
        ctx.pageParam || initialPageParam
      );

      console.log(
        `bl query fn running ${queryOptions.mode}:${queryOptions.cursorSequenceNum ?? queryOptions.cursorPostId}`,
        queryOptions
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

      // postsLogger.log('loading posts', { queryOptions, options });
      // // We should figure out why this is necessary.
      // if (
      //   queryOptions &&
      //   queryOptions.mode === 'newest' &&
      //   !options.hasCachedNewest
      // ) {
      //   await sync.syncPosts(queryOptions, {
      //     priority: SyncPriority.High,
      //     abortSignal: abortControllerRef.current?.signal,
      //   });
      // }

      // let cached: db.Post[] = [];
      // if (queryOptions.mode === 'newest' || queryOptions.cursorSequenceNum) {
      //   cached = await db.getSequencedChannelPosts({ ...queryOptions });
      // } else if (queryOptions.cursorPostId) {
      //   const cursorPost = await db.getPost({
      //     postId: queryOptions.cursorPostId,
      //   });
      //   if (cursorPost && cursorPost.sequenceNum) {
      //     console.log(`ql:${queryFnId} using cursor post`, cursorPost);
      //     cached = await db.getSequencedChannelPosts({
      //       ...queryOptions,
      //       cursorSequenceNum: cursorPost.sequenceNum!,
      //     });
      //   } else {
      //     console.log(`ql:${queryFnId} cursor post not found, syncing`);
      //   }
      // }

      // if (cached?.length) {
      //   postsLogger.log(
      //     `ql:${queryFnId} returning`,
      //     cached.length,
      //     'posts from db'
      //   );
      //   return {
      //     posts: cached,
      //     canFetchNewerPosts:
      //       queryOptions.mode !== 'newest' || !options.hasCachedNewest,
      //     // canFetchNewerPosts: false,
      //   };
      // }

      // // load from API
      // let newestSequenceNum: number | null = null;
      // let reachedEnd = false;
      // if (queryOptions.cursorPostId) {
      //   postsLogger.log(
      //     `ql:${queryFnId} no posts found in database, loading from api...`
      //   );
      //   const res = await sync.syncPosts(
      //     {
      //       ...queryOptions,
      //       cursor: queryOptions.cursorPostId,
      //       count: options.count ?? 50,
      //     },
      //     {
      //       priority: SyncPriority.High,
      //       abortSignal: abortControllerRef.current?.signal,
      //     }
      //   );
      //   reachedEnd = res.newer === null;
      //   postsLogger.log(
      //     `ql:${queryFnId} loaded`,
      //     res.posts?.length,
      //     'posts from api',
      //     {
      //       res,
      //     }
      //   );
      // } else if (
      //   queryOptions.cursorSequenceNum &&
      //   queryOptions.mode !== 'newest'
      // ) {
      //   const res = await sync.syncSequencedPosts({
      //     channelId: queryOptions.channelId,
      //     cursorSequenceNum: queryOptions.cursorSequenceNum,
      //     mode: queryOptions.mode,
      //     count: options.count ?? 50,
      //   });
      //   newestSequenceNum = res.newestSequenceNum;
      //   postsLogger.log(
      //     `ql:${queryFnId} loaded`,
      //     res?.posts.length,
      //     'posts from api (sequenced)',
      //     {
      //       res,
      //     }
      //   );
      // } else {
      //   postsLogger.trackError(
      //     'invariant violation, needed to fetch from API with invalid cursor/mode combination',
      //     queryOptions
      //   );
      // }

      // let secondResult: db.Post[] = [];
      // if (queryOptions.cursorPostId) {
      //   const cursorPost = await db.getPost({
      //     postId: queryOptions.cursorPostId,
      //   });
      //   if (cursorPost) {
      //     secondResult = await db.getSequencedChannelPosts({
      //       ...queryOptions,
      //       cursorSequenceNum: cursorPost.sequenceNum!,
      //     });
      //   } else {
      //     const allPosts = await db.getChanPosts({
      //       channelId: queryOptions.channelId,
      //     });
      //     console.log(
      //       `ql:${queryFnId} invariant violation, cannot find cursor post after fetching from api`,
      //       allPosts
      //     );
      //   }
      // } else {
      //   secondResult = await db.getSequencedChannelPosts(queryOptions);
      // }
      // postsLogger.log(
      //   `ql:${queryFnId} returning`,
      //   secondResult?.length,
      //   'posts from db after syncing from api'
      //   // {
      //   //   mode: queryOptions.mode,
      //   //   numPostsFetched: res.posts?.length,
      //   //   canFetchNewerPosts: res.newer != null,
      //   //   resNewer: res.newer,
      //   // }
      // );

      // console.log(`blcheck:${queryFnId} result`, {
      //   mode: queryOptions.mode,
      //   cursorSeq: queryOptions.cursorSequenceNum,
      //   resultUpper: secondResult?.[0]?.sequenceNum,
      //   resultLower: secondResult?.at(-1)?.sequenceNum,
      //   allSeqs: secondResult?.map((p) => p.sequenceNum),
      //   endReached: reachedEnd,
      //   newestSequenceNum,
      //   canFetchNewerPosts: !(
      //     reachedEnd ||
      //     secondResult.some((p) => p.sequenceNum === newestSequenceNum)
      //   ),
      // });

      // return {
      //   posts: secondResult ?? [],
      //   canFetchNewerPosts: !(
      //     reachedEnd ||
      //     secondResult.some((p) => p.sequenceNum === newestSequenceNum)
      //   ),
      //   // canFetchNewerPosts: false,
      // };
    },
    queryKey,
    getNextPageParam: (
      lastPage,
      _allPages,
      lastPageParam
    ): UseChannelPostsPageParams | undefined => {
      const oldestPost = lastPage.posts.at(-1);
      const lastPageIsEmpty = !oldestPost?.id;

      if (lastPageIsEmpty) {
        return undefined;
        // // If we've only tried to get newer posts + that's failed, try using the
        // // same cursor to get older posts instead. This can happen when the
        // // first cached page is empty.
        // if (lastPageParam?.mode === 'newer' && lastPageParam.cursorPostId) {
        //   return {
        //     ...options,
        //     mode: 'older',
        //     cursorPostId: lastPageParam.cursorPostId,
        //   };
        // } else {
        //   return undefined;
        // }
      }

      // check if we're at the beginning of the channel
      if (oldestPost && oldestPost.sequenceNum === 1) {
        return undefined;
      }

      return {
        // ...options,
        channelId: options.channelId,
        count: options.count ?? 50,
        mode: 'older',
        // cursor: oldestPost?.id,
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
      const hasReachedNewest = allPages.some((p) => !p.canFetchNewerPosts);
      // console.log(
      //   `has reached newest?`,
      //   hasReachedNewest,
      //   allPages.map((p) => p.canFetchNewerPosts)
      // );

      if (hasReachedNewest) {
        return undefined;
      }

      return {
        // ...options,
        channelId: options.channelId,
        count: options.count ?? 50,
        mode: 'newer',
        cursorSequenceNum: firstPage.posts[0].sequenceNum!,
      };
    },
  });

  // useEffect(() => {
  //   if (
  //     !query.isFetching &&
  //     query.hasPreviousPage &&
  //     query.data?.pages.length === 1
  //   ) {
  //     query.fetchPreviousPage();
  //   }
  // }, [query]);

  useEffect(() => {
    const pages = query.data?.pages;
    const params: UseChannelPostsPageParams[] = query.data
      ?.pageParams as unknown as UseChannelPostsPageParams[];

    const atBeginning = pages?.some((p) => !p.canFetchNewerPosts);

    const stuff = pages?.map((page, index) => {
      const param = params?.[index];
      return {
        pageNum: index,
        mode: param?.mode,
        cursorPostId: param?.cursorPostId,
        cursorSequenceNum: param?.cursorSequenceNum,
        dataMax: page.posts?.[0]?.sequenceNum,
        dataMin: page.posts?.at(-1)?.sequenceNum,
        canFetchNewerPosts: page.canFetchNewerPosts,
      };
    });

    console.log(`bl:dataLog`, stuff);
  }, [query.data]);

  // When we get a new post from the listener, add it to the pending list
  // and attempt to update query data.
  const [newPosts, setNewPosts] = useState<db.Post[]>([]);
  const handleNewPost = useCallback(
    (post: db.Post) => {
      console.log(`bl: received new post in listener`, post);
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

  const rawPosts = useMemo<db.Post[] | null>(() => {
    const queryPosts = query.data?.pages.flatMap((p) => p.posts) ?? null;
    // console.log(`bl:q assembling raw posts`, {
    //   queryPosts,
    //   newPosts,
    //   pages: query.data?.pages,
    // });
    if (!newPosts.length || query.hasPreviousPage) {
      // console.log(`bl:q not at newest, hiding new posts`);
      return queryPosts;
    } else {
      // console.log(`bl:q at newest, showing new posts`, newPosts);
    }
    const newestQueryPostId = queryPosts?.[0]?.id;
    const newerPosts = newPosts.filter(
      (p) => !newestQueryPostId || p.id > newestQueryPostId
    );

    // console.log('bl: newer debug', {
    //   raw: newPosts,
    //   newestQueryPostId,
    //   resolved: newerPosts,
    // });
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
    return newestQueryPostId ? [...newerPosts, ...dedupedQueryPosts] : newPosts;
  }, [query.data, query.hasPreviousPage, newPosts]);

  const sequenceStubsRemoved = useMemo(() => {
    if (!rawPosts?.length) {
      return [];
    }
    const filtered = rawPosts.filter((p) => !p.isSequenceStub);
    // console.log(`bl:stub filtered ${rawPosts.length - filtered.length} posts`);
    return filtered;
  }, [rawPosts]);

  const pendingPosts = usePendingPostsInChannel(options.channelId);
  const postsWithPending = useMemo(
    () =>
      mergePendingPosts({
        pendingPosts,
        existingPosts: sequenceStubsRemoved ?? [],
        hasNewest: !query.hasPreviousPage,
      }),
    [pendingPosts, sequenceStubsRemoved, query.hasPreviousPage]
  );
  // const postsWithPending = useMemo(() => {
  //   if (!pendingPosts.length) {
  //     return rawPosts;
  //   }

  //   if (!rawPosts?.length) {
  //     return pendingPosts.reverse();
  //   }

  //   let pendingMarker = 0; // lowest index is oldest
  //   let rawMarker = rawPosts?.length - 1; // highest index is oldest
  //   const composite = [];
  //   while (pendingMarker < pendingPosts.length || rawMarker >= 0) {
  //     const currPending = pendingPosts[pendingMarker];
  //     const currRaw = rawPosts[rawMarker];
  //     const olderRaw =
  //       rawMarker < rawPosts.length - 1 ? rawPosts[rawMarker + 1] : null;

  //     if (currPending.sentAt === currRaw.sentAt) {
  //       composite.push(currRaw);
  //       pendingMarker++;
  //       rawMarker--;
  //       continue;
  //     }

  //     if (
  //       currRaw &&
  //       olderRaw &&
  //       currPending.sentAt > olderRaw.sentAt &&
  //       currPending.sentAt < currRaw.sentAt
  //     ) {
  //       composite.push(currPending);
  //       pendingMarker++;
  //       continue;
  //     }

  //     composite.push(currRaw);
  //     rawMarker--;
  //   }

  //   return composite.reverse();
  // }, [rawPosts, pendingPosts]);

  const deletedPosts = useDeletedPosts(options.channelId);
  const postsWithDeleteFilterApplied = useMemo(() => {
    if (!options.filterDeleted) {
      return postsWithPending;
    }
    return postsWithPending?.filter((p) => !p.isDeleted && !deletedPosts[p.id]);
  }, [options.filterDeleted, postsWithPending, deletedPosts]);

  // const oneLastDedupe = useMemo(() => {
  //   const ids = new Set<string>();
  //   const posts = [];
  //   for (const post of postsWithDeleteFilterApplied ?? []) {
  //     if (!ids.has(post.id)) {
  //       ids.add(post.id);
  //       posts.push(post);
  //     }
  //   }
  //   return posts;
  // }, [postsWithDeleteFilterApplied]);

  const posts = useOptimizedQueryResults(postsWithDeleteFilterApplied);

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

  // console.log(`bl:postsFinal ${posts?.length} posts`, posts);

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
