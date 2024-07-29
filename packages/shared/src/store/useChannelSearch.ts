import { useInfiniteQuery } from '@tanstack/react-query';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { useEffect, useMemo } from 'react';

import { searchChannel } from '../api/channelsApi';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { useAttachAuthorToPosts } from './useAttachAuthorToPosts';

const MIN_RESULT_LOAD_THRESHOLD = 20;

const logger = createDevLogger('channel search', true);

export function useChannelSearch(channel: db.Channel, query: string) {
  const {
    results,
    searchedThroughDate,
    isLoading: apiLoading,
    isError: apiError,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteChannelSearch(channel, query);

  const posts = useAttachAuthorToPosts(results);

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

export function useInfiniteChannelSearch(channel: db.Channel, query: string) {
  const { data, ...rest } = useInfiniteQuery({
    queryKey: ['channel', channel.id, 'search', query],
    enabled: query !== '',
    queryFn: async ({ pageParam }) => {
      logger.log(`searching`, query, pageParam);
      const response = await searchChannel({
        channel,
        query,
        cursor: pageParam,
      });
      logger.log(`got result page`, response.posts.length);

      return response;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => {
      if (lastPage.cursor === null) return undefined;
      return lastPage.cursor;
    },
  });

  const results = useMemo(
    () =>
      data?.pages
        .flatMap((page) => page.posts)
        .sort((a, b) => b.sentAt - a.sentAt) ?? [],
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
