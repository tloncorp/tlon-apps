import { useInfiniteQuery } from '@tanstack/react-query';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { useEffect, useMemo } from 'react';

import { searchChatChannel } from '../api/channelsApi';
import { useAttachAuthorToPostInserts } from './useAttachAuthorToPostInserts';

const MIN_RESULT_LOAD_THRESHOLD = 20;

export function useChannelSearch(channelId: string, query: string) {
  const {
    results,
    searchedThroughDate,
    isLoading: apiLoading,
    isError: apiError,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteChannelSearch(channelId, query);

  const posts = useAttachAuthorToPostInserts(results);

  // Makes sure we load enough results to fill the screen before relying on infinite scroll
  useEffect(() => {
    if (
      results.length < MIN_RESULT_LOAD_THRESHOLD &&
      hasNextPage &&
      !apiLoading
    ) {
      fetchNextPage();
    }
  }, [results, hasNextPage, apiLoading, fetchNextPage]);

  return {
    posts,
    searchedThroughDate,
    loading: apiLoading,
    errored: apiError,
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
  };
}

export function useInfiniteChannelSearch(channelId: string, query: string) {
  const { data, ...rest } = useInfiniteQuery({
    queryKey: ['channel', channelId, 'search', query],
    enabled: query !== '',
    queryFn: async ({ pageParam }) => {
      const response = await searchChatChannel({
        channelId,
        query,
        cursor: pageParam,
      });

      return response;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      if (lastPage.cursor === null) return undefined;
      return lastPage.cursor;
    },
  });

  const results = useMemo(
    () => data?.pages.flatMap((page) => page.posts) ?? [],
    [data]
  );

  const searchedThroughDate = useMemo(() => {
    const params = data?.pages ?? [];
    const lastValidCursor = params.findLast(
      (page) => page.cursor !== null
    )?.cursor;
    return lastValidCursor ? new Date(daToUnix(bigInt(lastValidCursor))) : null;
  }, [data]);

  return {
    ...rest,
    results,
    searchedThroughDate,
  };
}
