import { useInfiniteQuery } from '@tanstack/react-query';
import {
  ChanScam,
  ChatMap,
  ReplyTuple,
  newChatMap,
} from '@tloncorp/shared/dist/urbit/channel';
import {
  ChatScan,
  ChatScanItem,
  Writ,
  WritTuple,
  newWritMap,
} from '@tloncorp/shared/dist/urbit/dms';
import { decToUd } from '@urbit/api';
import { daToUnix } from '@urbit/aura';
import bigInt from 'big-integer';
import _ from 'lodash';
import { useMemo } from 'react';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import api from '@/api';
import {
  createStorageKey,
  stringToTa,
  whomIsDm,
  whomIsMultiDm,
} from '@/logic/utils';

type Whom = string;
type SearchResult = ChatMap;

interface QueryHistory {
  queries: string[];
  lastQuery: {
    query: string;
    result: SearchResult;
  };
}

interface SearchState {
  history: Record<Whom, QueryHistory>;
}

export function serializeHistory(
  history: Record<Whom, QueryHistory> = {}
): string {
  const serialized = {} as Record<Whom, any>;
  Object.entries(history).forEach(([whom, queryHistory]) => {
    const { queries, lastQuery } = queryHistory!;
    serialized[whom] = {
      queries,
      lastQuery: {
        query: lastQuery.query,
        result: [...lastQuery.result.entries()],
      },
    };
  });

  return JSON.stringify(serialized);
}

export function deserializeHistory(serialized: string) {
  const history = {} as Record<Whom, QueryHistory>;
  const parsed = JSON.parse(serialized);
  Object.entries(parsed).forEach(([whom, queryHistory]) => {
    const { queries, lastQuery } = queryHistory as {
      queries: string[];
      lastQuery: { query: string; result: [string, Writ][] };
    };
    history[whom] = {
      queries,
      lastQuery: {
        query: lastQuery.query,
        result: newWritMap(
          lastQuery.result.map(([time, writ]) => [bigInt(time), writ])
        ),
      },
    };
  });
  return history;
}

export const useSearchState = create<SearchState>(
  persist(
    () => ({
      history: {},
    }),
    {
      name: createStorageKey('search'),
      serialize(data) {
        const history = data.state.history || {};
        return JSON.stringify({
          ...data,
          state: {
            history: serializeHistory(history),
          },
        });
      },
      deserialize(serialized) {
        const data = JSON.parse(serialized);
        data.state.history = deserializeHistory(data.state.history);
        return data;
      },
    }
  )
);

export function updateSearchHistory(
  whom: string,
  query: string,
  result: SearchResult
) {
  useSearchState.setState((state) => {
    const history = state.history || {};
    const queryHistory = history[whom] || { queries: [] };
    const queries = [query, ...queryHistory.queries.filter((q) => q !== query)];
    if (queries.length > 3) {
      queries.pop();
    }
    const lastQuery = { query, result };
    return {
      history: { ...history, [whom]: { queries, lastQuery } },
    };
  });
}

export function useInfiniteChatSearch(whom: string, query: string) {
  const SINGLE_PAGE_SEARCH_DEPTH = 500;
  const encodedQuery = stringToTa(query);
  const type = whomIsDm(whom) ? 'dm' : whomIsMultiDm(whom) ? 'club' : 'chat';
  const { data, ...rest } = useInfiniteQuery({
    enabled: query !== '',
    queryKey: ['chat', 'search', whom, query],
    queryFn: async ({ pageParam = null }) => {
      const res = await api.scry<ChatScam>({
        app: 'chat',
        path: `/${type}/${whom}/search/bounded/text/${
          pageParam ? decToUd(pageParam.toString()) : '~' // TODO  vite proxy bug
        }/${SINGLE_PAGE_SEARCH_DEPTH}/${encodedQuery}`,
      });
      return res;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.last === null) return undefined;
      return lastPage.last;
    },
  });

  const scan = useMemo(
    () =>
      newChatMap(
        (data?.pages || [])
          .reduce((a: ChatScan, b: ChatScam): ChatScan => [...a, ...b.scan], [])
          .flat()
          .map((scItem: ChatScanItem) =>
            scItem && 'writ' in scItem
              ? ([bigInt(scItem.writ.seal.time), scItem.writ] as WritTuple)
              : ([
                  bigInt(scItem.reply.reply.seal.time),
                  scItem.reply.reply,
                ] as ReplyTuple)
          ),
        true
      ),
    [data]
  );

  if (query !== '' && data?.pages?.length === 1) {
    updateSearchHistory(whom, query, scan);
  }

  const depth = useMemo(
    () => (data?.pages.length ?? 0) * SINGLE_PAGE_SEARCH_DEPTH,
    [data]
  );

  const oldestMessageSearched = useMemo(() => {
    const params = data?.pages ?? [];
    const lastValidParam = _.findLast(
      params,
      (page) => page.last !== null
    )?.last;
    return lastValidParam ? new Date(daToUnix(bigInt(lastValidParam))) : null;
  }, [data]);

  return {
    scan,
    depth,
    oldestMessageSearched,
    ...rest,
  };
}
