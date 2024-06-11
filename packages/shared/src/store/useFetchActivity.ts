import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import * as db from '../db';

export interface ActivityFetcher {
  canFetchMoreActivity: boolean;
  fetchMoreActivity: () => void;
  isFetching: boolean;
}

export function useFetchActivity(): ActivityFetcher {
  const infiniteQuery = useInfiniteQuery({
    queryKey: ['activity'],
    queryFn: async (): Promise<db.ActivityEvent[]> => {
      console.log('bl: fetching more activity');
      return [];
    },
    initialPageParam: Date.now(),
    getNextPageParam: (lastPage) => {
      if (lastPage === null) return undefined;
      return 1; // stub
    },
    getPreviousPageParam: (firstPage) => {
      return 2; // stub
    },
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
    () => infiniteQuery.isFetching,
    [infiniteQuery.isFetching]
  );

  return {
    canFetchMoreActivity,
    fetchMoreActivity,
    isFetching,
  };
}
