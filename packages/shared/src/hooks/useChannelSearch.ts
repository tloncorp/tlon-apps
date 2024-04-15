import _ from 'lodash';
import { useEffect } from 'react';

import * as api from '../api';
import { useAttachAuthorToPostInserts } from './util/useAttachAuthorToPostInserts';

const MIN_RESULT_LOAD_THRESHOLD = 20;

export function useChannelSearch(channelId: string, query: string) {
  const {
    results,
    searchedThroughDate,
    isLoading: apiLoading,
    isError: apiError,
    hasNextPage,
    fetchNextPage,
  } = api.useInfiniteChannelSearch(channelId, query);

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
