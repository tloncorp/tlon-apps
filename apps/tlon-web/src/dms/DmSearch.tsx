import { useEffect } from 'react';
import { useParams } from 'react-router';

import ChatSearch, { ChatSearchProps } from '@/chat/ChatSearch/ChatSearch';
import { CHANNEL_SEARCH_RESULT_SIZE } from '@/constants';
import { useInfiniteChatSearch } from '@/state/chat/search';

export default function DmSearch(
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
  } = useInfiniteChatSearch(props.whom, query || '');

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
        depth,
        oldestMessageSearched,
        numResults: scan.toArray().length,
        searchComplete: !hasNextPage,
      }}
    >
      {props.children}
    </ChatSearch>
  );
}
