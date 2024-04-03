// import type { ChannelScam } from '@tloncorp/shared/dist/urbit/channel';
import * as api from '@tloncorp/shared/dist/api';
import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';

export default function useChatSearch(channelId: string, query?: string) {
  const [fetchState, setFetchState] = useState<Promise<void> | null>(null);
  const [searchState, setSearchState] = useState<{
    cursor: string | null;
    pageNum: number;
    results: unknown[];
  }>({
    cursor: 'init',
    pageNum: 0,
    results: [],
  });

  useEffect(() => {
    setSearchState({ cursor: 'init', results: [], pageNum: 0 });
  }, [query]);

  const fetchResults = useCallback(async () => {
    if (!query) return;
    const response = await api.searchChatChannel({
      channelId,
      query,
      page: searchState.cursor === 'init' ? undefined : searchState.cursor,
    });
    return response;
    // if (response) {
    //   setSearchState({
    //     cursor: response.last,
    //     pageNum: searchState.pageNum + 1,
    //     results: searchState.results.concat(response.scan),
    //   });
    // }
  }, [
    channelId,
    query,
    searchState.cursor,
    searchState.pageNum,
    searchState.results,
  ]);

  useEffect(() => {
    if (!fetchState && searchState.cursor === 'init') {
      const fetchPage = fetchResults();
      setFetchState(fetchPage);
    }
  }, [fetchState, searchState]);

  if (!query) {
    return {
      results: [],
      loading: false,
      hasNextPage: false,
      fetchNextPage: _.noop,
    };
  }
}
