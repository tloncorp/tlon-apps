import api from '@/api';
import { whomIsDm, whomIsMultiDm } from '@/logic/utils';
import { ChatScan, ChatWrit, newWritMap } from '@/types/chat';
import { useInfiniteQuery } from '@tanstack/react-query';
import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useMemo } from 'react';
import BTree from 'sorted-btree';
import create from 'zustand';

type Whom = string;
type SearchResult = BTree<bigInt.BigInteger, ChatWrit>;

interface QueryHistory {
  queries: string[];
  lastQuery: {
    query: string;
    result: SearchResult;
  };
}

interface SearchState {
  history: Map<Whom, QueryHistory>;
}

export const useSearchState = create<SearchState>(() => ({
  history: new Map(),
}));

export function updateSearchHistory(
  whom: string,
  query: string,
  result: SearchResult
) {
  useSearchState.setState((state) => {
    const history = state.history || new Map();
    const queryHistory = history.get(whom) || { queries: [] };
    const queries = [query, ...queryHistory.queries.filter((q) => q !== query)];
    if (queries.length > 3) {
      queries.pop();
    }
    const lastQuery = { query, result };
    return {
      history: new Map(state.history).set(whom, { queries, lastQuery }),
    };
  });
}

export function useInfiniteChatSearch(whom: string, query: string) {
  const type = whomIsDm(whom) ? 'dm' : whomIsMultiDm(whom) ? 'club' : 'chat';
  const { data, ...rest } = useInfiniteQuery({
    queryKey: ['chat', 'search', whom, query],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.scry<ChatScan>({
        app: 'chat',
        path: `/${type}/${whom}/search/text/${pageParam}/20/${query}`,
      });
      return res;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 0) return undefined;
      return allPages.length * 20;
    },
  });

  const scan = useMemo(() => {
    return newWritMap(
      (data?.pages || [])
        .flat()
        .map(({ time, writ }) => [bigInt(udToDec(time)), writ]),
      true
    );
  }, [data]);

  if (query !== '' && data?.pages.length === 1) {
    updateSearchHistory(whom, query, scan);
  }

  return {
    scan,
    ...rest,
  };
}
