import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { useActivityBucketCursors } from './dbHooks';

const logger = createDevLogger('useInfiniteBucketedActivity', true);

export interface ActivityFetcher {
  canFetchMoreActivity: boolean;
  fetchMoreActivity: () => void;
  isFetching: boolean;
  activity: db.SourceActivityEvents[];
}

export interface BucketFetchers {
  all: ActivityFetcher;
  mentions: ActivityFetcher;
  replies: ActivityFetcher;
}

export const INFINITE_ACTIVITY_QUERY_KEY = 'useInfiniteBucketedActivity';

export function resetActivityFetchers() {
  logger.log('bl: resetting activity fetchers');
  const fetchers = ['all', 'mentions', 'replies'];
  for (const fetcher in fetchers) {
    api.queryClient.setQueryData([INFINITE_ACTIVITY_QUERY_KEY, fetcher], () => {
      return {
        pages: [],
        pageParams: [],
      };
    });
  }
  api.queryClient.invalidateQueries({
    queryKey: [INFINITE_ACTIVITY_QUERY_KEY],
  });
}

export function useInfiniteBucketedActivity(
  bucket: db.ActivityBucket
): ActivityFetcher {
  const { data: bucketCursors } = useActivityBucketCursors();
  const bucketCursor = useMemo(
    () => (bucketCursors ? bucketCursors[bucket] : Infinity),
    [bucket, bucketCursors]
  );

  const infiniteQuery = useInfiniteQuery({
    queryKey: [INFINITE_ACTIVITY_QUERY_KEY, bucket],
    queryFn: async ({ pageParam }): Promise<db.SourceActivityEvents[]> => {
      const { cursor, existingSourceIds } = pageParam;
      logger.log(`query fn running`, bucket, pageParam);

      // check DB for all activity events in the bucket AFTER the specified cursor timestamp
      const events = await db.getBucketedActivityPage({
        bucket,
        startCursor: cursor,
        existingSourceIds,
      });
      logger.log('got events from db', events.length, events);

      // if we have some events, return them
      if (events.length > 0) {
        return events;
      }

      // if we don't, hit the api with the given cursor
      const fetchedPage = await api.getPagedActivityByBucket({
        bucket,
        cursor,
      });
      logger.log('fetched next page from API', fetchedPage);

      // if we got some stuff, insert it into the DB & update the cusor
      if (fetchedPage.events.length > 0) {
        await db.insertActivityEvents(fetchedPage.events);
        await db.setActivityBucketCursor(
          bucket,
          fetchedPage.nextCursor ?? -Infinity
        );
        const events = await db.getBucketedActivityPage({
          bucket,
          startCursor: cursor,
          existingSourceIds,
        });
        logger.log('new DB page after fetching', events.length, events);
        return events;
      }

      // if we got nothing, we're at the end. That's all the activity!
      logger.log(`no more activity for bucket ${bucket}`);
      return [];
    },
    initialPageParam: { existingSourceIds: [] as string[], cursor: Date.now() },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage === null || lastPage.length === 0) {
        return null;
      }

      const cursor = lastPage[lastPage.length - 1].newest.timestamp;
      const existingSourceIds = allPages.flatMap((page) =>
        page.flatMap((item) => item.sourceId)
      );
      return {
        cursor,
        existingSourceIds,
      };
    },
    // never fetch newer, we only load older or pull to refresh and reset
    getPreviousPageParam: () => null,
  });

  const canFetchMoreActivity = useMemo(
    () => infiniteQuery.hasNextPage,
    [infiniteQuery.hasNextPage]
  );
  const fetchMoreActivity = useMemo(
    () => infiniteQuery.fetchNextPage,
    [infiniteQuery.fetchNextPage]
  );

  const isFetching = useMemo(
    () => infiniteQuery.isFetchingNextPage,
    [infiniteQuery.isFetchingNextPage]
  );

  const activity = useMemo(() => {
    const allActivitySources = infiniteQuery.data?.pages.flat() ?? [];
    return allActivitySources.sort(
      (a, b) => b.newest.timestamp - a.newest.timestamp
    );
  }, [infiniteQuery.data?.pages]);

  return {
    canFetchMoreActivity,
    fetchMoreActivity,
    isFetching,
    activity,
  };
}
