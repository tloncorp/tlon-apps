import { useEffect } from 'react';
import { useParams } from 'react-router';

import ChatSearch, { ChatSearchProps } from '@/chat/ChatSearch/ChatSearch';
import { CHANNEL_SEARCH_RESULT_SIZE } from '@/constants';
import { useChannelSearch } from '@/state/channel/channel';

export default function ChannelSearch(
  props: Omit<ChatSearchProps, 'scan' | 'query' | 'isLoading' | 'endReached'>
) {
  const { query } = useParams<{ query: string }>();
  const {
    scan,
    isLoading,
    fetchNextPage,
    depth,
    oldestMessageSearched,
    hasNextPage,
  } = useChannelSearch(props.whom, query || '');

  useEffect(() => {
    const numResults = scan.toArray().length;
    if (!isLoading && numResults < CHANNEL_SEARCH_RESULT_SIZE) {
      fetchNextPage();
    }
  }, [fetchNextPage, isLoading, scan, depth]);

  return (
    <ChatSearch
      {...props}
      query={query}
      scan={scan}
      isLoading={isLoading}
      endReached={fetchNextPage}
      searchDetails={{
        numResults: scan.toArray().length,
        depth,
        oldestMessageSearched,
        searchComplete: !hasNextPage,
      }}
    >
      {props.children}
    </ChatSearch>
  );
}
