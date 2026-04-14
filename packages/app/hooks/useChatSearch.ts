import { configurationFromChannel } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import Fuse from 'fuse.js';
import { debounce } from 'lodash';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { getChannelTitle, getGroupTitle } from '../ui/utils/channelUtils';
import {
  ChatSearchCandidate,
  ChatSearchFuzzyScore,
  hasAllChatSearchTokens,
  normalizeChatSearchString,
  rankChatSearchCandidates,
  tokenPresenceScore,
  tokenizeChatSearchQuery,
} from './chatSearchRanking';

type ChatSearchDoc<TChat extends db.Chat> = ChatSearchCandidate & {
  chat: TChat;
};

type ChatSearchSource<TChat extends db.Chat> = {
  key: string;
  docs: ChatSearchDoc<TChat>[];
  fuse: Fuse<ChatSearchDoc<TChat>>;
  allChats: TChat[];
};

type ChatSearchResult<TChat extends db.Chat> = {
  sourceKey: string;
  query: string;
  chats: TChat[];
};

function buildChatSearchDoc<TChat extends db.Chat>(
  chat: TChat,
  disableNicknames: boolean
): ChatSearchDoc<TChat> {
  const title = normalizeChatSearchString(getChatTitle(chat, disableNicknames));
  const groupTitle = normalizeChatSearchString(
    chat.type === 'channel' && chat.channel.group
      ? getGroupTitle(chat.channel.group, disableNicknames)
      : ''
  );
  const id = normalizeChatSearchString(chat.id);
  return {
    chat,
    id,
    title,
    groupTitle,
    combined: `${title} ${groupTitle} ${id}`.trim(),
    timestamp: chat.timestamp,
  };
}

function getChatTitle(chat: db.Chat, disableNicknames: boolean): string {
  if (chat.type === 'channel') {
    return getChannelTitle({
      ...configurationFromChannel(chat.channel),
      channelTitle: chat.channel.title,
      members: chat.channel.members,
      disableNicknames,
    });
  }

  return getGroupTitle(chat.group, disableNicknames);
}

function scoreSubstringMatch(
  candidate: ChatSearchCandidate,
  normalizedQuery: string
) {
  return (
    tokenPresenceScore(candidate.title, normalizedQuery, {
      exact: 120,
      prefix: 90,
      contains: 48,
    }) +
    tokenPresenceScore(candidate.groupTitle, normalizedQuery, {
      exact: 70,
      prefix: 50,
      contains: 20,
    }) +
    tokenPresenceScore(candidate.id, normalizedQuery, {
      exact: 28,
      prefix: 20,
      contains: 10,
    })
  );
}

function searchChatDocs<TChat extends db.Chat>(
  docs: ChatSearchDoc<TChat>[],
  fuse: Fuse<ChatSearchDoc<TChat>>,
  query: string
): TChat[] {
  const normalizedQuery = normalizeChatSearchString(query);
  if (!normalizedQuery) {
    return [];
  }

  const directMatches = docs.filter((candidate) =>
    candidate.combined.includes(normalizedQuery)
  );

  if (directMatches.length > 0) {
    directMatches.sort((a, b) => {
      const scoreDiff =
        scoreSubstringMatch(b, normalizedQuery) -
        scoreSubstringMatch(a, normalizedQuery);

      return scoreDiff !== 0 ? scoreDiff : b.timestamp - a.timestamp;
    });

    return directMatches.map((candidate) => candidate.chat);
  }

  const tokens = tokenizeChatSearchQuery(query);
  const fuzzyResults = fuse.search(normalizedQuery);

  if (tokens.length <= 1) {
    return fuzzyResults.map((result) => result.item.chat);
  }

  const tokenMatchedCandidates = docs.filter((candidate) =>
    hasAllChatSearchTokens(candidate, tokens)
  );

  if (!tokenMatchedCandidates.length) {
    return fuzzyResults.map((result) => result.item.chat);
  }

  const fuzzyScores = new Map<string, ChatSearchFuzzyScore>(
    fuzzyResults.map((result, rank) => [
      result.item.id,
      {
        rank,
        score: result.score ?? Number.POSITIVE_INFINITY,
      },
    ])
  );

  return rankChatSearchCandidates(
    tokenMatchedCandidates,
    tokens,
    normalizedQuery,
    fuzzyScores
  ).map((candidate) => candidate.chat);
}

function createChatSearchSource<TChat extends db.Chat>(
  chats: TChat[],
  disableNicknames: boolean,
  key: string
): ChatSearchSource<TChat> {
  const docs = chats.map((chat) => buildChatSearchDoc(chat, disableNicknames));

  return {
    key,
    docs,
    allChats: chats,
    fuse: new Fuse(docs, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.45,
      keys: [
        { name: 'combined', weight: 0.75 },
        { name: 'title', weight: 0.15 },
        { name: 'groupTitle', weight: 0.08 },
        { name: 'id', weight: 0.02 },
      ],
    }),
  };
}

function useDebouncedValue<T>(input: T, delay: number) {
  const [value, setValue] = useState<T>(input);
  const debouncedSetValue = useMemo(
    () => debounce(setValue, delay, { leading: true }),
    [delay]
  );

  useLayoutEffect(() => {
    if (delay <= 0) {
      debouncedSetValue.cancel();
      setValue(input);
      return;
    }

    debouncedSetValue(input);
  }, [debouncedSetValue, delay, input]);

  useEffect(() => {
    return () => debouncedSetValue.cancel();
  }, [debouncedSetValue]);

  return delay <= 0 ? input : value;
}

export function useChatSearch<TChat extends db.Chat>({
  chats,
  searchQuery,
  debounceMs,
  disableNicknames,
  semanticCacheKey,
}: {
  chats: TChat[];
  searchQuery: string;
  debounceMs: number;
  disableNicknames: boolean;
  semanticCacheKey?: string;
}) {
  const sourceCacheRef = useRef<ChatSearchSource<TChat> | null>(null);
  const resultCacheRef = useRef<ChatSearchResult<TChat> | null>(null);
  const searchSource = useMemo(() => {
    if (!semanticCacheKey) {
      return createChatSearchSource(chats, disableNicknames, '');
    }

    const cachedSource = sourceCacheRef.current;
    if (cachedSource?.key === semanticCacheKey) {
      return cachedSource;
    }

    const nextSource = createChatSearchSource(
      chats,
      disableNicknames,
      semanticCacheKey
    );
    sourceCacheRef.current = nextSource;
    return nextSource;
  }, [chats, disableNicknames, semanticCacheKey]);
  const searchDocsList = searchSource.docs;
  const searchFuse = searchSource.fuse;
  const allChats = searchSource.allChats;

  const debouncedQuery = useDebouncedValue(searchQuery, debounceMs);
  const trimmedQuery = debouncedQuery.trim();
  const isSearching = trimmedQuery !== '';

  const results = useMemo(() => {
    if (!isSearching) {
      return [];
    }

    if (semanticCacheKey) {
      const cachedResult = resultCacheRef.current;
      if (
        cachedResult?.sourceKey === searchSource.key &&
        cachedResult.query === trimmedQuery
      ) {
        return cachedResult.chats;
      }
    }

    const nextChats = searchChatDocs(searchDocsList, searchFuse, trimmedQuery);

    if (semanticCacheKey) {
      resultCacheRef.current = {
        sourceKey: searchSource.key,
        query: trimmedQuery,
        chats: nextChats,
      };
    }

    return nextChats;
  }, [
    isSearching,
    searchDocsList,
    searchFuse,
    searchSource.key,
    semanticCacheKey,
    trimmedQuery,
  ]);

  return {
    isSearching,
    results,
    allChats,
  };
}
