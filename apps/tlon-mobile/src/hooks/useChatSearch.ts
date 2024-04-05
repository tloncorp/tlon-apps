import * as api from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { useEffect, useMemo } from 'react';

const MIN_RESULT_LOAD_THRESHOLD = 20;

export default function useChatSearch(channelId: string, query: string) {
  const {
    results,
    searchedThroughDate,
    isLoading: apiLoading,
    isError: apiError,
    hasNextPage,
    fetchNextPage,
  } = api.useInfiniteChannelSearch(channelId, query);

  const resultIds = useMemo(
    () => results.map((result) => result.id),
    [results]
  );

  const { result: posts, isLoading: dbLoading } = db.useChannelSearchResults(
    channelId,
    resultIds
  );

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
    loading: apiLoading || dbLoading,
    errored: apiError,
    hasMore: hasNextPage,
    loadMore: fetchNextPage,
  };
}
