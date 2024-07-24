import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as logic from '../logic';
import * as sync from './sync';

const logger = createDevLogger('useInfiniteBucketedActivity', true);

export interface ActivityFetcher {
  canFetchMoreActivity: boolean;
  fetchMoreActivity: () => void;
  isFetching: boolean;
  activity: logic.SourceActivityEvents[];
}

export interface BucketFetchers {
  all: ActivityFetcher;
  mentions: ActivityFetcher;
  replies: ActivityFetcher;
}

export const INFINITE_ACTIVITY_QUERY_KEY = 'useInfiniteBucketedActivity';

export function resetActivityFetchers() {
  logger.log('resetting activity fetchers');
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

interface PageParam {
  cursor: number | null;
  existingSourceIds: string[];
}

export function useInfiniteBucketedActivity(
  bucket: db.ActivityBucket
): ActivityFetcher {
  const infiniteQuery = useInfiniteQuery({
    queryKey: [INFINITE_ACTIVITY_QUERY_KEY, bucket],
    queryFn: async ({
      pageParam,
    }: {
      pageParam: PageParam;
    }): Promise<logic.SourceActivityEvents[]> => {
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
      const apiResponse = await api.getPagedActivityByBucket({
        bucket,
        cursor: cursor ?? Date.now(),
      });
      logger.log('fetched next page from API', apiResponse);

      // if we got some stuff, insert it into the DB & update the cusor
      if (apiResponse.events.length > 0) {
        await db.insertActivityEvents(apiResponse.events);
        await sync.persistUnreads({ unreads: apiResponse.relevantUnreads });
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
    initialPageParam: { existingSourceIds: [], cursor: null } as PageParam,
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
