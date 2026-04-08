import { TalkSidebarFilter } from '@tloncorp/api/urbit';
import { configurationFromChannel, useMessagesFilter } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import Fuse from 'fuse.js';
import { debounce } from 'lodash';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useCalm } from '../ui/contexts/appDataContext';
import { getChannelTitle, getGroupTitle } from '../ui/utils/channelUtils';
import {
  ChatSearchCandidate,
  ChatSearchFuzzyScore,
  hasAllChatSearchTokens,
  normalizeChatSearchString,
  rankChatSearchCandidates,
  tokenizeChatSearchQuery,
} from './chatSearchRanking';

export type TabName =
  | 'all'
  | 'home'
  | 'groups'
  | 'messages'
  | 'talk'
  | 'channels';

export type SectionedChatData = {
  title: string;
  data: db.Chat[];
}[];

type ChatSearchDoc = ChatSearchCandidate & {
  chat: db.Chat;
};

function getAllSectionHeader(
  activeTab: TabName,
  msgsFilter?: TalkSidebarFilter
): string {
  if (activeTab === 'talk') {
    if (msgsFilter === 'Group Channels') {
      return 'Chat Channels';
    }

    return msgsFilter ?? 'Direct Messages';
  }

  return 'All';
}

export function useFilteredChats({
  pinned,
  unpinned,
  pending,
  searchQuery,
  activeTab,
}: {
  pinned: db.Chat[];
  unpinned: db.Chat[];
  pending: db.Chat[];
  searchQuery: string;
  activeTab: TabName;
}): SectionedChatData {
  const { disableNicknames } = useCalm();
  const { data } = useMessagesFilter();
  const talkFilter = useMemo(
    () =>
      activeTab === 'talk' ? data ?? 'Direct Messages' : 'Direct Messages',
    [data, activeTab]
  );
  const chats = useMemo(
    () => [...pinned, ...unpinned, ...pending],
    [pinned, unpinned, pending]
  );
  const searchableChats = useMemo(
    () => filterChats(chats, activeTab, talkFilter),
    [chats, activeTab, talkFilter]
  );
  const getSearchTitle = useCallback(
    (chat: db.Chat) => getChatTitle(chat, disableNicknames),
    [disableNicknames]
  );
  const getSearchGroupTitle = useCallback(
    (chat: db.Chat) => {
      if (chat.type !== 'channel' || !chat.channel.group) {
        return '';
      }

      return getGroupTitle(chat.channel.group, disableNicknames);
    },
    [disableNicknames]
  );
  const searchDocs = useMemo(
    () =>
      buildChatSearchDocs({
        chats: searchableChats,
        getChatTitle: getSearchTitle,
        getGroupTitleForChat: getSearchGroupTitle,
      }),
    [searchableChats, getSearchTitle, getSearchGroupTitle]
  );
  const searchFuse = useMemo(
    () => createChatSearchFuse(searchDocs),
    [searchDocs]
  );
  const performSearch = useCallback(
    (query: string) => {
      return searchChatDocs({
        docs: searchDocs,
        fuse: searchFuse,
        query,
      });
    },
    [searchDocs, searchFuse]
  );
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const searchResults = useMemo(
    () => performSearch(debouncedQuery),
    [debouncedQuery, performSearch]
  );

  return useMemo(() => {
    const isSearching = searchQuery && searchQuery.trim() !== '';
    if (!isSearching) {
      const pinnedSection = {
        title: 'Pinned',
        data: filterChats(pinned, activeTab, talkFilter),
      };
      const allSection = {
        title: getAllSectionHeader(activeTab, talkFilter),
        data: filterChats([...pending, ...unpinned], activeTab, talkFilter),
      };
      return pinnedSection.data.length
        ? [pinnedSection, allSection]
        : [allSection];
    } else {
      return [
        {
          title: 'Search results',
          data: searchResults,
        },
      ];
    }
  }, [
    activeTab,
    pending,
    searchQuery,
    searchResults,
    unpinned,
    pinned,
    talkFilter,
  ]);
}

function buildChatSearchDocs({
  chats,
  getChatTitle,
  getGroupTitleForChat,
}: {
  chats: db.Chat[];
  getChatTitle: (chat: db.Chat) => string;
  getGroupTitleForChat: (chat: db.Chat) => string;
}): ChatSearchDoc[] {
  return chats.map((chat) => {
    const title = normalizeChatSearchString(getChatTitle(chat));
    const groupTitle = normalizeChatSearchString(getGroupTitleForChat(chat));
    const id = normalizeChatSearchString(chat.id);

    return {
      chat,
      id,
      title,
      groupTitle,
      combined: `${title} ${groupTitle} ${id}`.trim(),
      timestamp: chat.timestamp,
    };
  });
}

function createChatSearchFuse(docs: ChatSearchDoc[]) {
  return new Fuse(docs, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.45,
    keys: [
      { name: 'combined', weight: 0.75 },
      { name: 'title', weight: 0.15 },
      { name: 'groupTitle', weight: 0.08 },
      { name: 'id', weight: 0.02 },
    ],
  });
}

function searchChatDocs({
  docs,
  fuse,
  query,
}: {
  docs: ChatSearchDoc[];
  fuse: Fuse<ChatSearchDoc>;
  query: string;
}): db.Chat[] {
  const normalizedQuery = normalizeChatSearchString(query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = tokenizeChatSearchQuery(query);
  const fuzzyResults = fuse.search(normalizedQuery);

  if (!tokens.length) {
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

function filterChats(
  chats: db.Chat[],
  activeTab: TabName,
  filter: TalkSidebarFilter
) {
  return chats.filter((chat) => {
    if (activeTab === 'groups') {
      return chat.type === 'group';
    }

    if (
      activeTab === 'messages' ||
      activeTab === 'talk' ||
      activeTab === 'channels'
    ) {
      if (chat.type !== 'channel') {
        return false;
      }

      if (activeTab === 'channels') {
        return true;
      }

      if (filter === 'Direct Messages') {
        return chat.channel.type === 'dm' || chat.channel.type === 'groupDm';
      }

      if (filter === 'Group Channels') {
        return chat.channel.type === 'chat';
      }

      return (
        chat.channel.type === 'chat' ||
        chat.channel.type === 'dm' ||
        chat.channel.type === 'groupDm'
      );
    }

    if (activeTab === 'home') {
      return (
        chat.type === 'group' ||
        (chat.type === 'channel' && chat.channel.type === 'dm') ||
        (chat.type === 'channel' && chat.channel.type === 'groupDm')
      );
    }

    return true;
  });
}

function getChatTitle(chat: db.Chat, disableNicknames: boolean): string {
  if (chat.type === 'channel') {
    return getChannelTitle({
      disableNicknames,
      channelTitle: chat.channel.title,
      members: chat.channel.members,
      usesMemberListAsFallbackTitle: configurationFromChannel(chat.channel)
        .usesMemberListAsFallbackTitle,
    });
  } else {
    return getGroupTitle(chat.group, disableNicknames);
  }
}

function useDebouncedValue<T>(input: T, delay: number) {
  const [value, setValue] = useState<T>(input);
  const debouncedSetValue = useMemo(
    () => debounce(setValue, delay, { leading: true }),
    [delay]
  );
  useLayoutEffect(() => {
    debouncedSetValue(input);
  }, [debouncedSetValue, input]);
  return value;
}
